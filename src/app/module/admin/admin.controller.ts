import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { AdminService } from "./admin.service";

const provisionStaff = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.provisionStaff(req.body);

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

export const AdminController = {
	provisionStaff,
	updateUserStatus,
};