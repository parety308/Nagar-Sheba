import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await PaymentService.initiatePaymentSession(
		req.body.requestId,
		actor.userId,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Payment session created successfully",
		data: result,
	});
});

// SSLCommerz posts application/x-www-form-urlencoded here — the global
// express.urlencoded() in app.ts already parses it, no raw-body handling
// needed like Stripe's signature check required.

const handleIPN = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.handleIPN(req.body);
	res.status(httpStatus.OK).json(result);
});

const handleSuccess = catchAsync(async (req: Request, res: Response) => {
	const redirectUrl = await PaymentService.handleSuccessRedirect(req.body);
	res.redirect(redirectUrl);
});

const handleFail = catchAsync(async (req: Request, res: Response) => {
	const redirectUrl = await PaymentService.handleFailRedirect(req.body);
	res.redirect(redirectUrl);
});

const handleCancel = catchAsync(async (req: Request, res: Response) => {
	const redirectUrl = await PaymentService.handleCancelRedirect(req.body);
	res.redirect(redirectUrl);
});

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await PaymentService.getSinglePayment(
		req.params.id as string,
		actor,
	);

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
	handleIPN,
	handleSuccess,
	handleFail,
	handleCancel,
	getSinglePayment,
	getAllPayments,
};
