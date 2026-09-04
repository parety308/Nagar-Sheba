import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { FeedbackService } from "./feedback.service";

const createFeedback = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await FeedbackService.createFeedback({
		...req.body,
		citizenId: actor.userId,
	});

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Feedback submitted successfully",
		data: result,
	});
});

const getSingleFeedback = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await FeedbackService.getSingleFeedback(
		req.params.requestId as string,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Feedback fetched successfully",
		data: result,
	});
});

const getAllFeedbacks = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await FeedbackService.getAllFeedbacks(
		{
			page: Number(req.query.page),
			limit: Number(req.query.limit),
			rating: req.query.rating ? Number(req.query.rating) : undefined,
			departmentId: req.query.departmentId as string | undefined,
		},
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Feedback list fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const FeedbackController = {
	createFeedback,
	getSingleFeedback,
	getAllFeedbacks,
};
