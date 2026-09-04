import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
	PaymentProvider,
	PaymentStatus,
	RequestStatus,
	Role,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { bkashClient } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { createSSLCommerzInstance } from "../../lib/sslcommerz";
import { IRequestUser } from "../auth/auth.interface";
import { NotificationService } from "../notification/notification.service";
import { IPaymentQuery, TRequestForPayment } from "./payment.interface";

const buildTranId = (requestId: string) =>
	`NS-${requestId.slice(0, 8)}-${Date.now()}`;

// SSLCOMMERZ

const createSSLCommerzSession = async (
	request: TRequestForPayment,
	amount: Prisma.Decimal,
	tranId: string,
) => {
	const sslcz = createSSLCommerzInstance();

	const initData = {
		total_amount: Number(amount),
		currency: "BDT",
		tran_id: tranId,
		success_url: `${config.backend_url}/api/v1/payments/sslcommerz/success`,
		fail_url: `${config.backend_url}/api/v1/payments/sslcommerz/fail`,
		cancel_url: `${config.backend_url}/api/v1/payments/sslcommerz/cancel`,
		ipn_url: `${config.backend_url}/api/v1/payments/sslcommerz/ipn`,
		shipping_method: "NO",
		product_name: request.title,
		product_category: "Service Request Fee",
		product_profile: "general",
		cus_name: request.citizen.citizenProfile?.fullName ?? "Nagar Sheba Citizen",
		cus_email: request.citizen.email,
		cus_add1: request.citizen.citizenProfile?.address ?? "N/A",
		cus_city: "Chattogram",
		cus_postcode: "4000",
		cus_country: "Bangladesh",
		cus_phone: request.citizen.citizenProfile?.phone ?? "01700000000",
	};

	const apiResponse = await sslcz.init(initData);

	if (apiResponse.status !== "SUCCESS" || !apiResponse.GatewayPageURL) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`Failed to initiate SSLCommerz session: ${apiResponse.failedreason ?? "unknown error"}`,
		);
	}

	return {
		providerRef: tranId,
		checkoutUrl: apiResponse.GatewayPageURL as string,
	};
};

// BKASH

const createBkashSession = async (
	request: TRequestForPayment,
	amount: Prisma.Decimal,
) => {
	const invoiceNumber = buildTranId(request.id);

	const response = await bkashClient.createPayment({
		amount: Number(amount),
		invoiceNumber,
		callbackURL: `${config.backend_url}/api/v1/payments/bkash/callback`,
	});

	if (
		response.statusCode !== "0000" ||
		!response.bkashURL ||
		!response.paymentID
	) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`Failed to initiate bKash session: ${response.statusMessage ?? "unknown error"}`,
		);
	}

	return { providerRef: response.paymentID, checkoutUrl: response.bkashURL };
};

// INITIATE / RECREATE PAYMENT SESSION — provider-agnostic

const initiatePaymentSession = async (
	requestId: string,
	actorId: string,
	provider: "SSLCOMMERZ" | "BKASH" = "SSLCOMMERZ",
) => {
	const request = await prisma.serviceRequest.findUnique({
		where: { id: requestId },
		include: {
			payment: true,
			citizen: { select: { email: true, citizenProfile: true } },
		},
	});

	if (!request || request.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Service request not found");
	}

	if (request.citizenId !== actorId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to pay for this request",
		);
	}

	if (request.status !== RequestStatus.PENDING_PAYMENT) {
		throw new AppError(
			httpStatus.CONFLICT,
			`This request is ${request.status} and does not require payment`,
		);
	}

	if (!request.feeCharged || Number(request.feeCharged) <= 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This request has no payable fee amount",
		);
	}

	if (request.payment?.status === PaymentStatus.COMPLETED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This request has already been paid for",
		);
	}

	const session =
		provider === "BKASH"
			? await createBkashSession(request, request.feeCharged)
			: await createSSLCommerzSession(
					request,
					request.feeCharged,
					buildTranId(request.id),
				);

	const providerEnum =
		provider === "BKASH" ? PaymentProvider.BKASH : PaymentProvider.SSLCOMMERZ;

	if (request.payment) {
		const updated = await prisma.payment.update({
			where: { id: request.payment.id },
			data: {
				providerRef: session.providerRef,
				status: PaymentStatus.PENDING,
				amount: request.feeCharged,
				provider: providerEnum,
			},
		});
		return { paymentId: updated.id, checkoutUrl: session.checkoutUrl };
	}

	const created = await prisma.payment.create({
		data: {
			requestId: request.id,
			provider: providerEnum,
			providerRef: session.providerRef,
			amount: request.feeCharged,
			status: PaymentStatus.PENDING,
		},
	});

	return { paymentId: created.id, checkoutUrl: session.checkoutUrl };
};

// SHARED COMPLETION LOGIC — one place that flips Payment + ServiceRequest

const completePayment = async (paymentId: string) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: { request: true },
	});

	if (!payment) return;

	// Idempotent — duplicate callbacks/IPNs are routine for both gateways.
	if (payment.status === PaymentStatus.COMPLETED) return;

	await prisma.$transaction([
		prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
		}),
		prisma.serviceRequest.update({
			where: { id: payment.requestId },
			data: { status: RequestStatus.SUBMITTED },
		}),
		prisma.statusHistory.create({
			data: {
				requestId: payment.requestId,
				fromStatus: RequestStatus.PENDING_PAYMENT,
				toStatus: RequestStatus.SUBMITTED,
				changedBy: payment.request.citizenId,
				note: `Payment verified via ${payment.provider}`,
			},
		}),
	]);
	NotificationService.notifyUser({
		userId: payment.request.citizenId,
		type: "PAYMENT_COMPLETED",
		message: `Your payment of ${payment.amount} BDT was completed successfully.`,
	});
};

const failPaymentIfPending = async (paymentId: string) => {
	const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
	if (payment && payment.status === PaymentStatus.PENDING) {
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED },
		});
	}
};

// SSLCOMMERZ VERIFICATION (IPN + redirect handlers both call this)

const verifySSLCommerzAndComplete = async (tranId: string, valId: string) => {
	const payment = await prisma.payment.findUnique({
		where: { providerRef: tranId },
	});

	if (!payment) {
		console.error(
			`SSLCommerz callback: no Payment found for tran_id ${tranId}`,
		);
		return;
	}

	if (payment.status === PaymentStatus.COMPLETED) return;

	const sslcz = createSSLCommerzInstance();
	const validation = await sslcz.validate({ val_id: valId });

	const isValid =
		validation.status === "VALID" || validation.status === "VALIDATED";
	const amountMatches =
		Number(validation.amount) === Number(payment.amount) &&
		validation.currency === "BDT";

	if (!isValid || !amountMatches) {
		console.error(
			`SSLCommerz validation failed for payment ${payment.id}`,
			validation,
		);
		await failPaymentIfPending(payment.id);
		return;
	}

	await completePayment(payment.id);
};

const handleSSLCommerzIPN = async (body: Record<string, string>) => {
	const { tran_id, val_id, status } = body;

	if (!tran_id) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Missing tran_id in IPN payload",
		);
	}

	if (status !== "VALID" && status !== "VALIDATED") {
		const payment = await prisma.payment.findUnique({
			where: { providerRef: tran_id },
		});
		if (payment) await failPaymentIfPending(payment.id);
		return { received: true };
	}

	if (!val_id) {
		throw new AppError(httpStatus.BAD_REQUEST, "Missing val_id in IPN payload");
	}

	await verifySSLCommerzAndComplete(tran_id, val_id);
	return { received: true };
};

const handleSSLCommerzSuccessRedirect = async (
	body: Record<string, string>,
) => {
	const { tran_id, val_id } = body;
	if (tran_id && val_id) await verifySSLCommerzAndComplete(tran_id, val_id);
	return `${config.frontend_url}/payments/success?tran_id=${tran_id ?? ""}`;
};

const handleSSLCommerzFailRedirect = async (body: Record<string, string>) => {
	const { tran_id } = body;
	if (tran_id) {
		const payment = await prisma.payment.findUnique({
			where: { providerRef: tran_id },
		});
		if (payment) await failPaymentIfPending(payment.id);
	}
	return `${config.frontend_url}/payments/fail?tran_id=${tran_id ?? ""}`;
};

const handleSSLCommerzCancelRedirect = async (body: Record<string, string>) => {
	const { tran_id } = body;
	if (tran_id) {
		const payment = await prisma.payment.findUnique({
			where: { providerRef: tran_id },
		});
		if (payment) await failPaymentIfPending(payment.id);
	}
	return `${config.frontend_url}/payments/cancel?tran_id=${tran_id ?? ""}`;
};

// BKASH VERIFICATION — single callback URL, status differentiated by query

const handleBkashCallback = async (query: {
	paymentID?: string;
	status?: string;
}) => {
	const { paymentID, status } = query;

	if (!paymentID) {
		return `${config.frontend_url}/payments/fail?reason=missing_payment_id`;
	}

	const payment = await prisma.payment.findUnique({
		where: { providerRef: paymentID },
	});

	if (!payment) {
		console.error(
			`bKash callback: no Payment found for paymentID ${paymentID}`,
		);
		return `${config.frontend_url}/payments/fail?paymentID=${paymentID}`;
	}

	if (status === "cancel" || status === "failure") {
		await failPaymentIfPending(payment.id);
		return `${config.frontend_url}/payments/${status === "cancel" ? "cancel" : "fail"}?paymentID=${paymentID}`;
	}

	if (payment.status === PaymentStatus.COMPLETED) {
		return `${config.frontend_url}/payments/success?paymentID=${paymentID}`;
	}

	const executeResult = await bkashClient.executePayment(paymentID);

	const isCompleted = executeResult.transactionStatus === "Completed";
	const amountMatches = Number(executeResult.amount) === Number(payment.amount);

	if (!isCompleted || !amountMatches) {
		console.error(
			`bKash execute failed/mismatched for payment ${payment.id}`,
			executeResult,
		);
		await failPaymentIfPending(payment.id);
		return `${config.frontend_url}/payments/fail?paymentID=${paymentID}`;
	}

	await completePayment(payment.id);
	return `${config.frontend_url}/payments/success?paymentID=${paymentID}`;
};

// REFUND — provider-agnostic dispatcher

const refundSSLCommerz = async (payment: {
	id: string;
	providerRef: string;
	amount: Prisma.Decimal;
}) => {
	const sslcz = createSSLCommerzInstance();

	const txnQuery = await sslcz.transactionQueryByTransactionId({
		tran_id: payment.providerRef,
	});

	const record = txnQuery?.element?.[0];

	if (!record?.bank_tran_id) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Could not locate the bank transaction id for this payment — cannot process refund",
		);
	}

	const refundResponse = await sslcz.initiateRefund({
		refund_amount: Number(payment.amount),
		refund_remarks: "Citizen cancelled service request",
		bank_tran_id: record.bank_tran_id,
		refe_id: payment.id,
	});

	if (
		refundResponse.status !== "success" &&
		refundResponse.status !== "processing"
	) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`SSLCommerz refund failed: ${refundResponse.errorReason ?? "unknown error"}`,
		);
	}
};

const refundBkash = async (payment: {
	id: string;
	providerRef: string;
	amount: Prisma.Decimal;
}) => {
	const status = await bkashClient.queryPayment(payment.providerRef);

	if (!status.trxID) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Could not locate the bKash trxID for this payment — cannot process refund",
		);
	}

	const refundResponse = await bkashClient.refundTransaction({
		paymentID: payment.providerRef,
		trxID: status.trxID,
		amount: Number(payment.amount),
		reason: "Citizen cancelled service request",
	});

	if (refundResponse.statusCode !== "0000") {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`bKash refund failed: ${refundResponse.statusMessage ?? "unknown error"}`,
		);
	}
};

// REFUND — provider-agnostic dispatcher (unchanged: refundSSLCommerz, refundBkash stay as-is)

// SHARED CORE — refunds by Payment row directly. Used by both the automatic
// cancel-flow path (refundPaymentForRequest) and the manual Admin retry
// endpoint (manualRefundPayment).

const executeRefund = async (
	payment: {
		id: string;
		providerRef: string;
		amount: Prisma.Decimal;
		provider: PaymentProvider;
		status: PaymentStatus;
	},
	actorId: string,
) => {
	if (payment.status !== PaymentStatus.COMPLETED) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Only a COMPLETED payment can be refunded. Current status: ${payment.status}`,
		);
	}

	try {
		if (payment.provider === PaymentProvider.BKASH) {
			await refundBkash(payment);
		} else if (payment.provider === PaymentProvider.SSLCOMMERZ) {
			await refundSSLCommerz(payment);
		} else {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Refunds are not supported for provider ${payment.provider}`,
			);
		}
	} catch (error) {
		await prisma.auditLog.create({
			data: {
				actorId,
				action: "PAYMENT_REFUND_FAILED",
				entityType: "Payment",
				entityId: payment.id,
				previousValue: { status: payment.status },
				newValue: {
					attemptedStatus: PaymentStatus.REFUNDED,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			},
		});
		throw error;
	}

	const [updated] = await prisma.$transaction([
		prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
		}),
		prisma.auditLog.create({
			data: {
				actorId,
				action: "PAYMENT_REFUNDED",
				entityType: "Payment",
				entityId: payment.id,
				previousValue: { status: payment.status },
				newValue: { status: PaymentStatus.REFUNDED },
			},
		}),
	]);

	return updated;
};

// AUTOMATIC PATH — called from request.service.ts on citizen cancellation.
// Silently no-ops if there's no COMPLETED payment (nothing to refund).

const refundPaymentForRequest = async (requestId: string, actorId: string) => {
	const payment = await prisma.payment.findUnique({ where: { requestId } });

	if (!payment || payment.status !== PaymentStatus.COMPLETED) {
		return null;
	}

	return executeRefund(payment, actorId);
};

// MANUAL ADMIN PATH — explicit retry/trigger for a specific payment.
// Distinct from the automatic path in that it throws (rather than
// swallowing) so the Admin sees exactly why a refund didn't go through,
// and it records the Admin's reason on the audit trail.

const manualRefundPayment = async (
	paymentId: string,
	actor: IRequestUser,
	payload: { reason?: string },
) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			request: { select: { id: true, citizenId: true, trackingRef: true } },
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	if (
		payment.status === PaymentStatus.PENDING ||
		payment.status === PaymentStatus.FAILED
	) {
		throw new AppError(
			httpStatus.CONFLICT,
			`This payment was never completed (status: ${payment.status}) — there is nothing to refund`,
		);
	}

	if (payment.status === PaymentStatus.CANCELLED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This payment was cancelled and cannot be refunded",
		);
	}

	if (payment.status === PaymentStatus.REFUNDED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This payment has already been refunded",
		);
	}

	const updated = await executeRefund(payment, actor.userId);

	// Record the Admin's stated reason as a follow-up audit entry, kept
	// separate from PAYMENT_REFUNDED so the automated and manual paths
	// share one clean success-event shape.
	if (payload.reason) {
		await prisma.auditLog.create({
			data: {
				actorId: actor.userId,
				action: "PAYMENT_MANUAL_REFUND_REASON",
				entityType: "Payment",
				entityId: payment.id,
				previousValue: undefined,
				newValue: { reason: payload.reason },
			},
		});
	}

	return updated;
};
// READ (unchanged)

const getSinglePayment = async (paymentId: string, actor: IRequestUser) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			request: {
				select: { id: true, citizenId: true, trackingRef: true, title: true },
			},
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	if (actor.role === Role.STAFF) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to view payments",
		);
	}

	if (
		actor.role === Role.CITIZEN &&
		payment.request.citizenId !== actor.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to view this payment",
		);
	}

	return payment;
};

const ALLOWED_PAYMENT_SORT_FIELDS = ["createdAt", "amount", "status"];

const getAllPayments = async (query: IPaymentQuery, actor: IRequestUser) => {
	if (actor.role === Role.STAFF) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to view payments",
		);
	}

	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(
		Number(query.limit) > 0 ? Number(query.limit) : 10,
		100,
	);
	const skip = (page - 1) * limit;

	const sortBy = ALLOWED_PAYMENT_SORT_FIELDS.includes(query.sortBy as string)
		? (query.sortBy as string)
		: "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const where: Prisma.PaymentWhereInput = {
		...(actor.role === Role.CITIZEN
			? { request: { citizenId: actor.userId } }
			: {}),
		...(query.status ? { status: query.status as PaymentStatus } : {}),
		...(query.provider ? { provider: query.provider as PaymentProvider } : {}),
	};

	const [items, total] = await Promise.all([
		prisma.payment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: {
				request: { select: { id: true, trackingRef: true, title: true } },
			},
		}),
		prisma.payment.count({ where }),
	]);

	return {
		data: items,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
	};
};

export const PaymentService = {
	initiatePaymentSession,
	handleSSLCommerzIPN,
	handleSSLCommerzSuccessRedirect,
	handleSSLCommerzFailRedirect,
	handleSSLCommerzCancelRedirect,
	handleBkashCallback,
	refundPaymentForRequest,
	manualRefundPayment,
	getSinglePayment,
	getAllPayments,
};
