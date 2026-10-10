import { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { buildReceiptPdf } from "../../utils/receiptPdf";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await PaymentService.initiatePaymentSession(
		req.body.requestId,
		actor.userId,
		req.body.provider,
	);

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

const buildFallback = (
	outcome: "success" | "fail" | "cancel",
	tranId?: string,
) =>
	`${config.frontend_url?.replace(/\/$/, "")}/payments/${outcome}?tran_id=${tranId ?? ""}`;

const redirectHandler = (
	outcome: "success" | "fail" | "cancel",
	run: (body: Record<string, string>) => Promise<string>,
) =>
	catchAsync(async (req: Request, res: Response) => {
		const data = {
			...(req.query as Record<string, string>),
			...(req.body ?? {}),
		};

		try {
			const url = await run(data);
			res.redirect(303, url);
		} catch (error) {
			console.error(`SSLCommerz ${outcome} handler failed:`, error);

			const tranId = data.tran_id ?? "";
			const fallbackOutcome = outcome === "success" ? "fail" : outcome;
			const frontend = (config.frontend_url ?? "").replace(/\/$/, "");

			res.redirect(
				303,
				`${frontend}/payments/${fallbackOutcome}?tran_id=${encodeURIComponent(tranId)}`,
			);
		}
	});

const handleSSLCommerzSuccess = redirectHandler(
	"success",
	PaymentService.handleSSLCommerzSuccessRedirect,
);
const handleSSLCommerzFail = redirectHandler(
	"fail",
	PaymentService.handleSSLCommerzFailRedirect,
);
const handleSSLCommerzCancel = redirectHandler(
	"cancel",
	PaymentService.handleSSLCommerzCancelRedirect,
);

const handleBkashCallback = catchAsync(async (req: Request, res: Response) => {
	const redirectUrl = await PaymentService.handleBkashCallback({
		paymentID: req.query.paymentID as string | undefined,
		status: req.query.status as string | undefined,
	});
	// res.redirect(redirectUrl);
	res.redirect(303, redirectUrl);
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

const manualRefundPayment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await PaymentService.manualRefundPayment(
		req.params.id as string,
		actor,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment refunded successfully",
		data: result,
	});
});

const downloadReceipt = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const payment = await PaymentService.getReceiptData(
		req.params.id as string,
		actor,
	);

	res.setHeader("Content-Type", "application/pdf");
	res.setHeader(
		"Content-Disposition",
		`attachment; filename="receipt-${payment.request.trackingRef}.pdf"`,
	);

	buildReceiptPdf(payment).pipe(res);
});
export const PaymentController = {
	initiatePayment,
	handleSSLCommerzIPN,
	handleSSLCommerzSuccess,
	handleSSLCommerzFail,
	handleSSLCommerzCancel,
	handleBkashCallback,
	manualRefundPayment,
	getSinglePayment,
	getAllPayments,
	downloadReceipt,
};
