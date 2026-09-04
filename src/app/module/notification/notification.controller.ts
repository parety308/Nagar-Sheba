import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { NotificationService } from "./notification.service";

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await NotificationService.getMyNotifications(user.userId, {
		page: Number(req.query.page),
		limit: Number(req.query.limit),
		isRead:
			req.query.isRead === "true"
				? true
				: req.query.isRead === "false"
					? false
					: undefined,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notifications fetched successfully",
		data: { notifications: result.data, unreadCount: result.unreadCount },
		meta: result.meta,
	});
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await NotificationService.getUnreadCount(user.userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Unread notification count fetched successfully",
		data: result,
	});
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await NotificationService.markAsRead(
		user.userId,
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notification marked as read",
		data: result,
	});
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await NotificationService.markAllAsRead(user.userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All notifications marked as read",
		data: result,
	});
});

export const NotificationController = {
	getMyNotifications,
	getUnreadCount,
	markAsRead,
	markAllAsRead,
};