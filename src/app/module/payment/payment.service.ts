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
import { prisma } from "../../lib/prisma";
import { createSSLCommerzInstance } from "../../lib/sslcommerz";
import { IRequestUser } from "../auth/auth.interface";
import { IPaymentQuery } from "./payment.interface";

type TRequestForPayment = {
	id: string;
	trackingRef: string;
	title: string;
	citizen: {
		email: string;
		citizenProfile: {
			fullName: string;
			phone: string | null;
			address: string | null;
		} | null;
	};
};

// tran_id has to be unique per attempt — SSLCommerz doesn't let you "retrieve
// and reuse" a session the way Stripe checkout sessions work, so every
// initiate call (including a retry) gets a fresh one.
const buildTranId = (requestId: string) =>
	`NS-${requestId.slice(0, 8)}-${Date.now()}`;

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
		success_url: `${config.backend_url}/api/v1/payments/success`,
		fail_url: `${config.backend_url}/api/v1/payments/fail`,
		cancel_url: `${config.backend_url}/api/v1/payments/cancel`,
		ipn_url: `${config.backend_url}/api/v1/payments/ipn`,
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

	// const apiResponse = await sslcz.init(initData);
	const apiResponse = await sslcz.init(initData);

if (apiResponse.status !== "SUCCESS" || !apiResponse.GatewayPageURL) {
    throw new AppError(
        httpStatus.BAD_GATEWAY,
        `Failed to initiate SSLCommerz session: ${
            apiResponse.failedreason ?? "unknown error"
        }`,
    );
}

	return apiResponse.GatewayPageURL as string;
};

// INITIATE / RECREATE PAYMENT SESSION (API-28)
// Payment.requestId is still @unique, so this is the same "at most one
// Payment row per request" guarantee as before.

const initiatePaymentSession = async (requestId: string, actorId: string) => {
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

	const tranId = buildTranId(request.id);
	const gatewayUrl = await createSSLCommerzSession(
		request,
		request.feeCharged,
		tranId,
	);

	if (request.payment) {
		const updated = await prisma.payment.update({
			where: { id: request.payment.id },
			data: {
				providerRef: tranId,
				status: PaymentStatus.PENDING,
				amount: request.feeCharged,
				provider: PaymentProvider.SSLCOMMERZ,
			},
		});
		return { paymentId: updated.id, checkoutUrl: gatewayUrl };
	}

	const created = await prisma.payment.create({
		data: {
			requestId: request.id,
			provider: PaymentProvider.SSLCOMMERZ,
			providerRef: tranId,
			amount: request.feeCharged,
			status: PaymentStatus.PENDING,
		},
	});

	return { paymentId: created.id, checkoutUrl: gatewayUrl };
};

// SHARED VERIFICATION — called from both the IPN and the success redirect.
// Never trusts the posted status; always re-checks with SSLCommerz's
// Validation API using val_id before marking anything COMPLETED.

const verifyAndCompletePayment = async (tranId: string, valId: string) => {
	const payment = await prisma.payment.findUnique({
		where: { providerRef: tranId },
		include: { request: true },
	});

	if (!payment) {
		console.error(
			`SSLCommerz callback: no Payment found for tran_id ${tranId}`,
		);
		return;
	}

	// Idempotency: duplicate IPN + success-redirect firing for the same
	// payment (which happens routinely) is a no-op after the first.
	if (payment.status === PaymentStatus.COMPLETED) {
		return;
	}

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
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED },
		});
		return;
	}

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
				note: "Payment verified via SSLCommerz IPN",
			},
		}),
	]);
};

const markFailedIfPending = async (tranId: string) => {
	const payment = await prisma.payment.findUnique({
		where: { providerRef: tranId },
	});
	if (payment && payment.status === PaymentStatus.PENDING) {
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED },
		});
	}
};

// IPN (API-29 equivalent) — server-to-server, this is the source of truth.

const handleIPN = async (body: Record<string, string>) => {
	const { tran_id, val_id, status } = body;

	if (!tran_id) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Missing tran_id in IPN payload",
		);
	}

	if (status !== "VALID" && status !== "VALIDATED") {
		await markFailedIfPending(tran_id);
		return { received: true };
	}

	if (!val_id) {
		throw new AppError(httpStatus.BAD_REQUEST, "Missing val_id in IPN payload");
	}

	await verifyAndCompletePayment(tran_id, val_id);
	return { received: true };
};

// Browser redirect handlers — SSLCommerz POSTs here from the customer's
// browser right after checkout. These just re-run the same verification
// (cheap, idempotent) and bounce the citizen to the frontend; the IPN
// above already does the authoritative work in most cases.

const handleSuccessRedirect = async (body: Record<string, string>) => {
	const { tran_id, val_id } = body;
	if (tran_id && val_id) await verifyAndCompletePayment(tran_id, val_id);
	return `${config.frontend_url}/payments/success?tran_id=${tran_id ?? ""}`;
};

const handleFailRedirect = async (body: Record<string, string>) => {
	const { tran_id } = body;
	if (tran_id) await markFailedIfPending(tran_id);
	return `${config.frontend_url}/payments/fail?tran_id=${tran_id ?? ""}`;
};

const handleCancelRedirect = async (body: Record<string, string>) => {
	const { tran_id } = body;
	if (tran_id) await markFailedIfPending(tran_id);
	return `${config.frontend_url}/payments/cancel?tran_id=${tran_id ?? ""}`;
};

// REFUND (FR-019) — called from request.service.ts's cancelServiceRequest.
// SSLCommerz refunds need the bank_tran_id, which we didn't store on the
// Payment row, so we look it up via the Transaction Query API first.

const refundPaymentForRequest = async (requestId: string) => {
	const payment = await prisma.payment.findUnique({ where: { requestId } });

	if (!payment || payment.status !== PaymentStatus.COMPLETED) {
		return null;
	}

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

	return prisma.payment.update({
		where: { id: payment.id },
		data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
	});
};

// GET SINGLE PAYMENT (API-30) — provider-agnostic, unchanged from before

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

// LIST PAYMENTS (API-31) — unchanged from before

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
	handleIPN,
	handleSuccessRedirect,
	handleFailRedirect,
	handleCancelRedirect,
	refundPaymentForRequest,
	getSinglePayment,
	getAllPayments,
};
