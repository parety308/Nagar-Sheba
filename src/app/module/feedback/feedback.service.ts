import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { RequestStatus, Role } from "../../../generated/prisma/enums";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../auth/auth.interface";
import { ICreateFeedbackPayload, IFeedbackQuery } from "./feedback.interface";

// Only a resolved/closed request that belongs to the citizen, with no
// existing feedback yet (Feedback.requestId is @unique), can be reviewed.
const ELIGIBLE_STATUSES: RequestStatus[] = [
	RequestStatus.RESOLVED,
	RequestStatus.CLOSED,
];

const createFeedback = async (payload: ICreateFeedbackPayload) => {
	const request = await prisma.serviceRequest.findUnique({
		where: { id: payload.requestId },
		include: { feedback: true },
	});

	if (!request || request.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Service request not found");
	}

	if (request.citizenId !== payload.citizenId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to leave feedback on this request",
		);
	}

	if (!ELIGIBLE_STATUSES.includes(request.status)) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Feedback can only be left once a request is resolved or closed",
		);
	}

	if (request.feedback) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Feedback has already been submitted for this request",
		);
	}

	return prisma.feedback.create({
		data: {
			requestId: payload.requestId,
			citizenId: payload.citizenId,
			rating: payload.rating,
			comment: payload.comment,
		},
	});
};

const getSingleFeedback = async (requestId: string, actor: IRequestUser) => {
	const feedback = await prisma.feedback.findUnique({
		where: { requestId },
		include: { request: { select: { departmentId: true, citizenId: true } } },
	});

	if (!feedback) {
		throw new AppError(httpStatus.NOT_FOUND, "Feedback not found");
	}

	if (actor.role === Role.CITIZEN && feedback.citizenId !== actor.userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to view this feedback",
		);
	}

	if (actor.role === Role.STAFF) {
		const staffProfile = await prisma.staffProfile.findUnique({
			where: { userId: actor.userId },
		});
		if (
			!staffProfile ||
			staffProfile.departmentId !== feedback.request.departmentId
		) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You do not have permission to view this feedback",
			);
		}
	}

	return feedback;
};

// Admin/Staff-facing list — supports pagination, filter by rating/department
const getAllFeedbacks = async (query: IFeedbackQuery, actor: IRequestUser) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(
		Number(query.limit) > 0 ? Number(query.limit) : 10,
		100,
	);
	const skip = (page - 1) * limit;

	const where: Prisma.FeedbackWhereInput = {
		...(query.rating ? { rating: Number(query.rating) } : {}),
	};

	if (actor.role === Role.CITIZEN) {
		where.citizenId = actor.userId;
	} else if (actor.role === Role.STAFF) {
		const staffProfile = await prisma.staffProfile.findUnique({
			where: { userId: actor.userId },
		});
		if (!staffProfile) {
			throw new AppError(httpStatus.FORBIDDEN, "Staff profile not found");
		}
		where.request = { departmentId: staffProfile.departmentId };
	} else if (query.departmentId) {
		where.request = { departmentId: query.departmentId };
	}

	const [items, total] = await Promise.all([
		prisma.feedback.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				request: {
					select: {
						id: true,
						trackingRef: true,
						title: true,
						departmentId: true,
					},
				},
			},
		}),
		prisma.feedback.count({ where }),
	]);

	return {
		data: items,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
	};
};

export const FeedbackService = {
	createFeedback,
	getSingleFeedback,
	getAllFeedbacks,
};
