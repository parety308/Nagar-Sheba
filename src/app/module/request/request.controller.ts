import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { RequestService } from "./request.service";

const createServiceRequest = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const files = req.files as Express.Multer.File[] | undefined;

	const result = await RequestService.createServiceRequest({
		citizenId: user.userId,
		...req.body,
		files,
	});

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Service request created successfully",
		data: result,
	});
});

const getAllServiceRequests = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user as IRequestUser;

		const result = await RequestService.getAllServiceRequests(
			{
				page: Number(req.query.page),
				limit: Number(req.query.limit),
				status: req.query.status as string | undefined,
				departmentId: req.query.departmentId as string | undefined,
				categoryId: req.query.categoryId as string | undefined,
				overdue: req.query.overdue === "true",
				sortBy: req.query.sortBy as string | undefined,
				sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
			},
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Service requests fetched successfully",
			data: result.data,
			meta: result.meta,
		});
	},
);

const getSingleServiceRequest = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user as IRequestUser;

		const result = await RequestService.getSingleServiceRequest(
			req.params.id as string,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Service request fetched successfully",
			data: result,
		});
	},
);

const searchServiceRequests = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user as IRequestUser;

		const result = await RequestService.searchServiceRequests(
			req.query.q as string,
			{ page: Number(req.query.page), limit: Number(req.query.limit) },
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Search results fetched successfully",
			data: result.data,
			meta: result.meta,
		});
	},
);

const cancelServiceRequest = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await RequestService.cancelServiceRequest(
		req.params.id as string,
		user.userId,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Service request cancelled successfully",
		data: result,
	});
});

export const RequestController = {
	createServiceRequest,
	getAllServiceRequests,
	getSingleServiceRequest,
	searchServiceRequests,
	cancelServiceRequest,
};
