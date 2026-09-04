import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { AdminService } from "./admin.service";

const provisionStaff = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await AdminService.provisionStaff(req.body, actor);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Account provisioned successfully",
		data: result,
	});
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await AdminService.updateUserStatus(
		req.params.id as string,
		req.body,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User status updated successfully",
		data: result,
	});
});

// NEW

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getAllUsers({
		page: Number(req.query.page),
		limit: Number(req.query.limit),
		role: req.query.role as "CITIZEN" | "STAFF" | "ADMIN" | undefined,
		status: req.query.status as "ACTIVE" | "BLOCKED" | undefined,
		search: req.query.search as string | undefined,
		sortBy: req.query.sortBy as string | undefined,
		sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const updateUserRole = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await AdminService.updateUserRole(
		req.params.id as string,
		req.body,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User role updated successfully",
		data: result,
	});
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getAuditLogs({
		page: Number(req.query.page),
		limit: Number(req.query.limit),
		entityType: req.query.entityType as string | undefined,
		actorId: req.query.actorId as string | undefined,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit logs fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getDashboardStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Dashboard stats fetched successfully",
		data: result,
	});
});

export const AdminController = {
	provisionStaff,
	updateUserStatus,
	getAllUsers,
	updateUserRole,
	getAuditLogs,
	getDashboardStats,
};
