import { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../errors/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await PaymentService.initiatePaymentSession(req.body.requestId, actor.userId);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Payment session created successfully",
		data: result,
	});
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
	const signature = req.headers["stripe-signature"];

	if (!signature || typeof signature !== "string") {
		throw new AppError(httpStatus.BAD_REQUEST, "Missing Stripe signature header");
	}

	// req.body is a raw Buffer here — this route is mounted with
	// express.raw() in app.ts, BEFORE express.json(), because Stripe's
	// signature check needs the untouched body.
	const result = await PaymentService.handleStripeWebhook(req.body as Buffer, signature);

	res.status(httpStatus.OK).json(result);
});

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await PaymentService.getSinglePayment(req.params.id as string, actor);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment fetched successfully",
		data: result,
	});
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await PaymentService.getAllPayments(
		{
			page: Number(req.query.page),
			limit: Number(req.query.limit),
			status: req.query.status as string | undefined,
			provider: req.query.provider as string | undefined,
			sortBy: req.query.sortBy as string | undefined,
			sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
		},
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payments fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const PaymentController = {
	initiatePayment,
	handleWebhook,
	getSinglePayment,
	getAllPayments,
};