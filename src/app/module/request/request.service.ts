import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
	AttachmentType,
	FeeType,
	RequestStatus,
	Role,
} from "../../../generated/prisma/enums";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { uploadBufferToCloudinary } from "../../utils/uploadToCloudinary";
import { IRequestUser } from "../auth/auth.interface";
import {
	ICreateServiceRequestServicePayload,
	IRequestQuery,
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

	return {
		...fullRequest,
		paymentSession: isPaid ? null : undefined,
	};
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

	// TODO (Module E): if feeCharged is set and its Payment is COMPLETED,
	// trigger a provider refund here before/inside this transaction.

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

	return updated;
};

export const RequestService = {
	createServiceRequest,
	getAllServiceRequests,
	getSingleServiceRequest,
	searchServiceRequests,
	cancelServiceRequest,
};
