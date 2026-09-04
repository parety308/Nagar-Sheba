import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
	AccountStatus,
	AttachmentType,
	FeeType,
	RequestStatus,
	Role,
} from "../../../generated/prisma/enums";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { uploadBufferToCloudinary } from "../../utils/uploadToCloudinary";
import { IRequestUser } from "../auth/auth.interface";
import { NotificationService } from "../notification/notification.service";
import { PaymentService } from "../payment/payment.service";
import {
	IAddAttachmentPayload,
	ICreateServiceRequestServicePayload,
	IReassignRequestPayload,
	IReopenRequestPayload,
	IRequestQuery,
	IUpdateStatusPayload,
} from "./request.interface";

const generateTrackingRef = async () => {
	const year = new Date().getFullYear();
	const prefix = `NS-${year}-`;

	const existingCount = await prisma.serviceRequest.count({
		where: { trackingRef: { startsWith: prefix } },
	});

	const sequence = (existingCount + 1).toString().padStart(6, "0");
	return `${prefix}${sequence}`;
};

const MAX_TRACKING_REF_ATTEMPTS = 5;

const createRequestRecordWithUniqueRef = async (
	data: Omit<Prisma.ServiceRequestUncheckedCreateInput, "trackingRef">,
) => {
	for (let attempt = 0; attempt < MAX_TRACKING_REF_ATTEMPTS; attempt++) {
		const trackingRef = await generateTrackingRef();

		try {
			return await prisma.serviceRequest.create({
				data: { ...data, trackingRef },
			});
		} catch (error) {
			const isTrackingRefCollision =
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002" &&
				(error.meta?.target as string[] | undefined)?.includes("trackingRef");

			if (!isTrackingRefCollision) throw error;
		}
	}

	throw new AppError(
		httpStatus.INTERNAL_SERVER_ERROR,
		"Could not generate a unique tracking reference. Please try again.",
	);
};

const createServiceRequest = async (
	payload: ICreateServiceRequestServicePayload,
) => {
	const { citizenId, categoryId, files, ...requestDetails } = payload;

	const category = await prisma.category.findUnique({
		where: { id: categoryId },
	});

	if (!category || category.deletedAt || !category.isActive) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Category is unknown or inactive",
		);
	}

	const isPaid = category.feeType === FeeType.PAID;
	const initialStatus = isPaid
		? RequestStatus.PENDING_PAYMENT
		: RequestStatus.SUBMITTED;
	const feeCharged = isPaid ? category.feeAmount : null;

	let uploadedAttachments: { secure_url: string; public_id: string }[] = [];

	if (files && files.length > 0) {
		uploadedAttachments = await Promise.all(
			files.map((file) =>
				uploadBufferToCloudinary(
					file.buffer,
					"nagar-sheba/request-attachments",
				),
			),
		);
	}

	const created = await createRequestRecordWithUniqueRef({
		citizenId,
		categoryId,
		departmentId: category.departmentId,
		title: requestDetails.title,
		description: requestDetails.description,
		address: requestDetails.address,
		latitude: requestDetails.latitude,
		longitude: requestDetails.longitude,
		status: initialStatus,
		feeCharged,
	});

	if (uploadedAttachments.length > 0) {
		await prisma.attachment.createMany({
			data: uploadedAttachments.map((att) => ({
				requestId: created.id,
				uploadedBy: citizenId,
				url: att.secure_url,
				type: AttachmentType.EVIDENCE,
			})),
		});
	}

	const fullRequest = await prisma.serviceRequest.findUnique({
		where: { id: created.id },
		include: {
			category: { select: { id: true, name: true, feeType: true } },
			department: { select: { id: true, name: true } },
			attachments: true,
		},
	});

	let paymentSession = null;

	if (isPaid) {
		try {
			paymentSession = await PaymentService.initiatePaymentSession(
				created.id,
				citizenId,
			);
		} catch (error) {
			console.error(
				`Failed to initiate payment session for request ${created.id}:`,
				error,
			);
			// Request still exists as PENDING_PAYMENT; citizen can retry via
			// POST /api/v1/payments/initiate with the same requestId.
		}
	}

	return { ...fullRequest, paymentSession };
};

const ALLOWED_SORT_FIELDS = [
	"createdAt",
	"updatedAt",
	"title",
	"status",
	"slaDueAt",
];

const resolveScopeWhere = async (
	requester: IRequestUser,
): Promise<Prisma.ServiceRequestWhereInput> => {
	if (requester.role === Role.CITIZEN) {
		return { citizenId: requester.userId };
	}

	if (requester.role === Role.STAFF) {
		const staffProfile = await prisma.staffProfile.findUnique({
			where: { userId: requester.userId },
		});

		if (!staffProfile) {
			throw new AppError(httpStatus.FORBIDDEN, "Staff profile not found");
		}

		return { departmentId: staffProfile.departmentId };
	}

	return {};
};

const getAllServiceRequests = async (
	query: IRequestQuery,
	requester: IRequestUser,
) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(
		Number(query.limit) > 0 ? Number(query.limit) : 10,
		100,
	);
	const skip = (page - 1) * limit;

	const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy as string)
		? (query.sortBy as string)
		: "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const where: Prisma.ServiceRequestWhereInput = {
		deletedAt: null,
		...(await resolveScopeWhere(requester)),
	};

	if (query.status) where.status = query.status as RequestStatus;
	if (query.categoryId) where.categoryId = query.categoryId;
	if (query.departmentId && requester.role === Role.ADMIN) {
		where.departmentId = query.departmentId;
	}
	if (query.overdue === true) where.isOverdue = true;

	const [items, total] = await Promise.all([
		prisma.serviceRequest.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: {
				category: { select: { id: true, name: true } },
				department: { select: { id: true, name: true } },
			},
		}),
		prisma.serviceRequest.count({ where }),
	]);

	return {
		data: items,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
	};
};

const getSingleServiceRequest = async (id: string, requester: IRequestUser) => {
	const request = await prisma.serviceRequest.findUnique({
		where: { id },
		include: {
			category: true,
			department: true,
			attachments: true,
			statusHistory: { orderBy: { createdAt: "asc" } },
			citizen: {
				select: {
					id: true,
					email: true,
					citizenProfile: { select: { fullName: true } },
				},
			},
			assignedStaff: {
				select: {
					id: true,
					email: true,
					staffProfile: { select: { fullName: true } },
				},
			},
		},
	});

	if (!request || request.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Service request not found");
	}

	if (
		requester.role === Role.CITIZEN &&
		request.citizenId !== requester.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to view this request",
		);
	}

	if (requester.role === Role.STAFF) {
		const staffProfile = await prisma.staffProfile.findUnique({
			where: { userId: requester.userId },
		});

		if (!staffProfile || staffProfile.departmentId !== request.departmentId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You do not have permission to view this request",
			);
		}
	}

	return request;
};

const searchServiceRequests = async (
	q: string,
	query: IRequestQuery,
	requester: IRequestUser,
) => {
	if (!q || q.trim().length === 0) {
		throw new AppError(httpStatus.BAD_REQUEST, "Search query 'q' is required");
	}

	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(
		Number(query.limit) > 0 ? Number(query.limit) : 10,
		100,
	);
	const skip = (page - 1) * limit;

	const where: Prisma.ServiceRequestWhereInput = {
		deletedAt: null,
		...(await resolveScopeWhere(requester)),
		OR: [
			{ title: { contains: q, mode: "insensitive" } },
			{ trackingRef: { contains: q, mode: "insensitive" } },
		],
	};

	const [items, total] = await Promise.all([
		prisma.serviceRequest.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.serviceRequest.count({ where }),
	]);

	return {
		data: items,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
	};
};

const CANCELLABLE_STATUSES: RequestStatus[] = [
	RequestStatus.PENDING_PAYMENT,
	RequestStatus.SUBMITTED,
	RequestStatus.ASSIGNED,
];

const cancelServiceRequest = async (id: string, citizenId: string) => {
	const request = await prisma.serviceRequest.findUnique({ where: { id } });

	if (!request || request.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Service request not found");
	}
	if (request.citizenId !== citizenId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to cancel this request",
		);
	}
	if (!CANCELLABLE_STATUSES.includes(request.status)) {
		throw new AppError(
			httpStatus.CONFLICT,
			`A request in ${request.status} status can no longer be cancelled`,
		);
	}

	const [, updated] = await prisma.$transaction([
		prisma.statusHistory.create({
			data: {
				requestId: request.id,
				fromStatus: request.status,
				toStatus: RequestStatus.CANCELLED,
				changedBy: citizenId,
				note: "Cancelled by citizen",
			},
		}),
		prisma.serviceRequest.update({
			where: { id },
			data: { status: RequestStatus.CANCELLED, cancelledAt: new Date() },
		}),
	]);

	// Cancellation is already committed above — a refund-gateway failure must
	// NOT be surfaced as a failed cancellation to the citizen.
	try {
		await PaymentService.refundPaymentForRequest(id, citizenId);
	} catch (error) {
		console.error(`Refund failed for cancelled request ${id}:`, error);
		// The PAYMENT_REFUND_FAILED audit log entry (written inside
		// refundPaymentForRequest) is now the durable record an Admin can
		// use to find and manually retry this — see gap #4.
	}
	return updated;
};

const REOPEN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const STAFF_ALLOWED_TRANSITIONS: Partial<
	Record<RequestStatus, RequestStatus[]>
> = {
	[RequestStatus.ASSIGNED]: [RequestStatus.IN_PROGRESS],
	[RequestStatus.IN_PROGRESS]: [RequestStatus.RESOLVED],
};

const TERMINAL_STATUSES: RequestStatus[] = [
	RequestStatus.CLOSED,
	RequestStatus.CANCELLED,
];

const computeSlaDueAt = (fromDate: Date, slaHours: number) =>
	new Date(fromDate.getTime() + slaHours * 60 * 60 * 1000);

const transitionRequestStatus = async (
	requestId: string,
	actor: IRequestUser,
	payload: IUpdateStatusPayload,
) => {
	const toStatus = payload.toStatus as RequestStatus;

	const request = await prisma.serviceRequest.findUnique({
		where: { id: requestId },
		include: { category: { select: { slaHours: true } } },
	});

	if (!request || request.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Service request not found");
	}

	const isAdminOverride = actor.role === Role.ADMIN;

	if (actor.role === Role.STAFF) {
		const staffProfile = await prisma.staffProfile.findUnique({
			where: { userId: actor.userId },
		});

		if (!staffProfile || staffProfile.departmentId !== request.departmentId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You do not have permission to act on this request",
			);
		}

		if (request.assignedStaffId !== actor.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"This request is not assigned to you",
			);
		}

		const allowedNext = STAFF_ALLOWED_TRANSITIONS[request.status] ?? [];

		if (!allowedNext.includes(toStatus)) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Cannot transition from ${request.status} to ${toStatus}`,
			);
		}
	} else if (isAdminOverride) {
		if (TERMINAL_STATUSES.includes(request.status)) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Request is already ${request.status} and cannot be changed further`,
			);
		}

		if (toStatus === request.status) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Request is already in the requested status",
			);
		}
	} else {
		throw new AppError(httpStatus.FORBIDDEN, "Not authorized for this action");
	}

	if (toStatus === RequestStatus.RESOLVED && !payload.note?.trim()) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"A resolution note is required to resolve a request",
		);
	}

	const now = new Date();
	const updateData: Prisma.ServiceRequestUpdateInput = { status: toStatus };

	if (toStatus === RequestStatus.ASSIGNED && !request.slaDueAt) {
		updateData.slaDueAt = computeSlaDueAt(now, request.category.slaHours);
	}

	if (toStatus === RequestStatus.RESOLVED) {
		updateData.resolvedAt = now;
		updateData.isOverdue = request.slaDueAt ? now > request.slaDueAt : false;
	}

	const operations: Prisma.PrismaPromise<any>[] = [
		prisma.statusHistory.create({
			data: {
				requestId: request.id,
				fromStatus: request.status,
				toStatus,
				changedBy: actor.userId,
				note: payload.note,
			},
		}),
		prisma.serviceRequest.update({
			where: { id: requestId },
			data: updateData,
		}),
	];

	if (isAdminOverride) {
		operations.push(
			prisma.auditLog.create({
				data: {
					actorId: actor.userId,
					action: "REQUEST_STATUS_OVERRIDDEN",
					entityType: "ServiceRequest",
					entityId: request.id,
					previousValue: { status: request.status },
					newValue: { status: toStatus, note: payload.note },
				},
			}),
		);
	}

	const results = await prisma.$transaction(operations);
	NotificationService.notifyUser({
		userId: request.citizenId,
		type: "REQUEST_STATUS_CHANGED",
		message: `Your request "${request.title}" status changed to ${toStatus}.`,
	});

	if (toStatus === RequestStatus.ASSIGNED && request.assignedStaffId) {
		NotificationService.notifyUser({
			userId: request.assignedStaffId,
			type: "REQUEST_ASSIGNED",
			message: `You have been assigned request "${request.title}".`,
		});
	}
	return results[1];
};

const reassignRequest = async (
	requestId: string,
	adminActor: IRequestUser,
	payload: IReassignRequestPayload,
) => {
	const request = await prisma.serviceRequest.findUnique({
		where: { id: requestId },
		include: { category: { select: { slaHours: true } } },
	});

	if (!request || request.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Service request not found");
	}

	if (TERMINAL_STATUSES.includes(request.status)) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Request is already ${request.status} and can no longer be reassigned`,
		);
	}

	const now = new Date();
	const previousState = {
		departmentId: request.departmentId,
		assignedStaffId: request.assignedStaffId,
		status: request.status,
	};

	let resolvedDepartmentId: string;
	let resolvedStaffId: string | null;
	let newStatus: RequestStatus | undefined;
	let newSlaDueAt: Date | null | undefined;

	if (payload.staffId) {
		const staff = await prisma.user.findUnique({
			where: { id: payload.staffId },
			include: { staffProfile: true },
		});

		if (
			!staff ||
			staff.deletedAt ||
			staff.role !== Role.STAFF ||
			!staff.staffProfile
		) {
			throw new AppError(httpStatus.NOT_FOUND, "Staff member not found");
		}

		if (staff.status === AccountStatus.BLOCKED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot assign a blocked staff member",
			);
		}

		if (
			payload.departmentId &&
			payload.departmentId !== staff.staffProfile.departmentId
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Staff member does not belong to the specified department",
			);
		}

		resolvedDepartmentId = staff.staffProfile.departmentId;
		resolvedStaffId = staff.id;

		if (request.status === RequestStatus.SUBMITTED) {
			newStatus = RequestStatus.ASSIGNED;
			newSlaDueAt = computeSlaDueAt(now, request.category.slaHours);
		}
	} else {
		if (
			request.status === RequestStatus.IN_PROGRESS ||
			request.status === RequestStatus.RESOLVED
		) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Cannot unassign a request already in progress or resolved — provide a replacement staffId instead",
			);
		}

		const department = await prisma.department.findUnique({
			where: { id: payload.departmentId },
		});

		if (!department || department.deletedAt) {
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		}

		resolvedDepartmentId = department.id;
		resolvedStaffId = null;

		if (request.status === RequestStatus.ASSIGNED) {
			newStatus = RequestStatus.SUBMITTED;
			newSlaDueAt = null;
		}
	}

	const updateData: Prisma.ServiceRequestUpdateInput = {
		department: { connect: { id: resolvedDepartmentId } },
		assignedStaff: resolvedStaffId
			? { connect: { id: resolvedStaffId } }
			: { disconnect: true },
		...(newStatus ? { status: newStatus } : {}),
		...(newSlaDueAt !== undefined ? { slaDueAt: newSlaDueAt } : {}),
	};

	const operations: Prisma.PrismaPromise<any>[] = [];

	if (newStatus) {
		operations.push(
			prisma.statusHistory.create({
				data: {
					requestId: request.id,
					fromStatus: request.status,
					toStatus: newStatus,
					changedBy: adminActor.userId,
					note: payload.reason ?? "Reassigned by Admin",
				},
			}),
		);
	}

	const updateIndex = operations.length;
	operations.push(
		prisma.serviceRequest.update({
			where: { id: requestId },
			data: updateData,
		}),
	);

	operations.push(
		prisma.auditLog.create({
			data: {
				actorId: adminActor.userId,
				action: "REQUEST_REASSIGNED",
				entityType: "ServiceRequest",
				entityId: request.id,
				previousValue: previousState,
				newValue: {
					departmentId: resolvedDepartmentId,
					assignedStaffId: resolvedStaffId,
					reason: payload.reason,
				},
			},
		}),
	);

	const results = await prisma.$transaction(operations);
	if (resolvedStaffId) {
		NotificationService.notifyUser({
			userId: resolvedStaffId,
			type: "REQUEST_REASSIGNED",
			message: `You have been assigned request "${request.title}".`,
		});
	}
	return results[updateIndex];
};

const reopenRequest = async (
	requestId: string,
	citizenId: string,
	payload: IReopenRequestPayload,
) => {
	const request = await prisma.serviceRequest.findUnique({
		where: { id: requestId },
	});

	if (!request || request.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Service request not found");
	}

	if (request.citizenId !== citizenId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to reopen this request",
		);
	}

	if (request.status !== RequestStatus.RESOLVED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Only a resolved request can be reopened",
		);
	}

	if (
		!request.resolvedAt ||
		Date.now() - request.resolvedAt.getTime() > REOPEN_WINDOW_MS
	) {
		throw new AppError(
			httpStatus.CONFLICT,
			"The 3-day reopen window has passed",
		);
	}

	const [, updated] = await prisma.$transaction([
		prisma.statusHistory.create({
			data: {
				requestId: request.id,
				fromStatus: request.status,
				toStatus: RequestStatus.ASSIGNED,
				changedBy: citizenId,
				note: payload.reason,
			},
		}),
		prisma.serviceRequest.update({
			where: { id: requestId },
			data: { status: RequestStatus.ASSIGNED, resolvedAt: null },
		}),
	]);

	return updated;
};

const MAX_ATTACHMENTS_PER_REQUEST = 5;
const addAttachmentsToRequest = async (
	requestId: string,
	actor: IRequestUser,
	payload: IAddAttachmentPayload,
	files: Express.Multer.File[] | undefined,
) => {
	if (!files || files.length === 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"At least one attachment file is required",
		);
	}

	const request = await prisma.serviceRequest.findUnique({
		where: { id: requestId },
		include: { _count: { select: { attachments: true } } },
	});

	if (!request || request.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Service request not found");
	}

	let resolvedType: AttachmentType;

	if (actor.role === Role.CITIZEN) {
		if (request.citizenId !== actor.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You do not have permission to attach files to this request",
			);
		}

		if (payload.type && payload.type !== AttachmentType.EVIDENCE) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"A citizen may only attach EVIDENCE files",
			);
		}

		resolvedType = AttachmentType.EVIDENCE;
	} else if (actor.role === Role.STAFF) {
		if (request.assignedStaffId !== actor.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"This request is not assigned to you",
			);
		}

		if (payload.type && payload.type !== AttachmentType.RESOLUTION_PROOF) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Staff may only attach RESOLUTION_PROOF files",
			);
		}

		resolvedType = AttachmentType.RESOLUTION_PROOF;
	} else {
		resolvedType = (payload.type as AttachmentType) ?? AttachmentType.EVIDENCE;
	}

	const existingCount = request._count.attachments;

	if (existingCount + files.length > MAX_ATTACHMENTS_PER_REQUEST) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`This request already has ${existingCount} attachment(s); at most ${MAX_ATTACHMENTS_PER_REQUEST} are allowed in total`,
		);
	}

	const uploaded = await Promise.all(
		files.map((file) =>
			uploadBufferToCloudinary(file.buffer, "nagar-sheba/request-attachments"),
		),
	);

	await prisma.attachment.createMany({
		data: uploaded.map((att) => ({
			requestId: request.id,
			uploadedBy: actor.userId,
			url: att.secure_url,
			type: resolvedType,
		})),
	});

	return prisma.attachment.findMany({
		where: { requestId: request.id },
		orderBy: { createdAt: "asc" },
	});
};

export const RequestService = {
	createServiceRequest,
	getAllServiceRequests,
	getSingleServiceRequest,
	searchServiceRequests,
	cancelServiceRequest,
	transitionRequestStatus,
	reassignRequest,
	reopenRequest,
	addAttachmentsToRequest,
};
