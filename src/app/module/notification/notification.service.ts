import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import httpStatus from "http-status";
import {
	ICreateNotificationPayload,
	INotificationQuery,
} from "./notification.interface";

// Best-effort fire-and-forget notification creator.
// Never throws — a failed notification must NEVER roll back or block
// the business transaction that triggered it (status change, payment, etc).
const notifyUser = async (payload: ICreateNotificationPayload) => {
	try {
		await prisma.notification.create({
			data: {
				userId: payload.userId,
				type: payload.type,
				message: payload.message,
			},
		});
	} catch (error) {
		console.error("[NotificationService] Failed to create notification:", error);
	}
};

// Same as above but for multiple recipients (e.g. all admins).
const notifyUsers = async (
	userIds: string[],
	type: ICreateNotificationPayload["type"],
	message: string,
) => {
	try {
		await prisma.notification.createMany({
			data: userIds.map((userId) => ({ userId, type, message })),
		});
	} catch (error) {
		console.error("[NotificationService] Failed to create bulk notifications:", error);
	}
};

const getMyNotifications = async (userId: string, query: INotificationQuery) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(Number(query.limit) > 0 ? Number(query.limit) : 10, 100);
	const skip = (page - 1) * limit;

	const where = {
		userId,
		...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
	};

	const [items, total, unreadCount] = await Promise.all([
		prisma.notification.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.notification.count({ where }),
		prisma.notification.count({ where: { userId, isRead: false } }),
	]);

	return {
		data: items,
		unreadCount,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
	};
};

const getUnreadCount = async (userId: string) => {
	const count = await prisma.notification.count({
		where: { userId, isRead: false },
	});
	return { unreadCount: count };
};

const markAsRead = async (userId: string, notificationId: string) => {
	const notification = await prisma.notification.findUnique({
		where: { id: notificationId },
	});

	if (!notification) {
		throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
	}

	if (notification.userId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to update this notification",
		);
	}

	if (notification.isRead) {
		return notification;
	}

	return prisma.notification.update({
		where: { id: notificationId },
		data: { isRead: true },
	});
};

const markAllAsRead = async (userId: string) => {
	const result = await prisma.notification.updateMany({
		where: { userId, isRead: false },
		data: { isRead: true },
	});

	return { updatedCount: result.count };
};

export const NotificationService = {
	notifyUser,
	notifyUsers,
	getMyNotifications,
	getUnreadCount,
	markAsRead,
	markAllAsRead,
};