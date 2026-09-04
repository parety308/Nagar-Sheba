import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await PaymentService.initiatePaymentSession(req.body.requestId,actor.userId,req.body.provider);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Payment session created successfully",
		data: result,
	});
});

// ---- SSLCommerz ----

const handleSSLCommerzIPN = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.handleSSLCommerzIPN(req.body);
	res.status(httpStatus.OK).json(result);
});

const handleSSLCommerzSuccess = catchAsync(
	async (req: Request, res: Response) => {
		const redirectUrl = await PaymentService.handleSSLCommerzSuccessRedirect(
			req.body,
		);
		res.redirect(redirectUrl);
	},
);

const handleSSLCommerzFail = catchAsync(async (req: Request, res: Response) => {
	const redirectUrl = await PaymentService.handleSSLCommerzFailRedirect(
		req.body,
	);
	res.redirect(redirectUrl);
});

const handleSSLCommerzCancel = catchAsync(
	async (req: Request, res: Response) => {
		const redirectUrl = await PaymentService.handleSSLCommerzCancelRedirect(
			req.body,
		);
		res.redirect(redirectUrl);
	},
);

// ---- bKash ----
// bKash calls back with GET ?paymentID=...&status=success|failure|cancel

const handleBkashCallback = catchAsync(async (req: Request, res: Response) => {
	const redirectUrl = await PaymentService.handleBkashCallback({
		paymentID: req.query.paymentID as string | undefined,
		status: req.query.status as string | undefined,
	});
	res.redirect(redirectUrl);
});

// ---- Read ----

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
	handleSSLCommerzIPN,
	handleSSLCommerzSuccess,
	handleSSLCommerzFail,
	handleSSLCommerzCancel,
	handleBkashCallback,
	getSinglePayment,
	getAllPayments,
};
