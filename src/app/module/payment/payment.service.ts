import httpStatus from "http-status";
import type Stripe from "stripe";
import {
	PaymentProvider,
	PaymentStatus,
	RequestStatus,
	Role,
} from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { stripeClient } from "../../lib/stripe";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../auth/auth.interface";
import { IPaymentQuery } from "./payment.interface";

// CREATE A STRIPE CHECKOUT SESSION
// Amount is always derived from what's already stored on the request
// (feeCharged, snapshotted at submission time) — never from the client.

const createStripeCheckoutSession = async (
	request: { id: string; trackingRef: string; title: string },
	amount: Prisma.Decimal,
) => {
	const unitAmount = Math.round(Number(amount) * 100);

	return stripeClient.checkout.sessions.create({
		mode: "payment",
		payment_method_types: ["card"],
		line_items: [
			{
				price_data: {
					currency: config.stripe.currency,
					product_data: {
						name: `Nagar Sheba — ${request.title}`,
						description: `Service request ${request.trackingRef}`,
					},
					unit_amount: unitAmount,
				},
				quantity: 1,
			},
		],
		metadata: { requestId: request.id },
		success_url: `${config.frontend_url}/payments/success?requestId=${request.id}`,
		cancel_url: `${config.frontend_url}/payments/cancel?requestId=${request.id}`,
	});
};

// INITIATE / RECREATE PAYMENT SESSION (API-28)
// Payment.requestId is @unique in the schema, so there is at most ONE
// Payment row per request ever — "recreate" means updating that same row's
// providerRef, not inserting a new one. This is also what gives us the
// §10 duplicate-payment-prevention rule for free.

const initiatePaymentSession = async (requestId: string, actorId: string) => {
	const request = await prisma.serviceRequest.findUnique({
		where: { id: requestId },
		include: { payment: true },
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
		throw new AppError(httpStatus.BAD_REQUEST, "This request has no payable fee amount");
	}

	if (request.payment) {
		if (request.payment.status === PaymentStatus.COMPLETED) {
			throw new AppError(httpStatus.CONFLICT, "This request has already been paid for");
		}

		// Still PENDING: reuse the existing Stripe session if it hasn't expired.
		if (request.payment.status === PaymentStatus.PENDING) {
			const existingSession = await stripeClient.checkout.sessions.retrieve(
				request.payment.providerRef,
			);

			if (existingSession.status === "open" && existingSession.url) {
				return { paymentId: request.payment.id, checkoutUrl: existingSession.url };
			}
			// expired — fall through and issue a fresh session below
		}

		const session = await createStripeCheckoutSession(request, request.feeCharged);

		const updated = await prisma.payment.update({
			where: { id: request.payment.id },
			data: {
				providerRef: session.id,
				status: PaymentStatus.PENDING,
				amount: request.feeCharged,
			},
		});

		return { paymentId: updated.id, checkoutUrl: session.url as string };
	}

	// First initiate call for this request — no Payment row yet.
	const session = await createStripeCheckoutSession(request, request.feeCharged);

	const created = await prisma.payment.create({
		data: {
			requestId: request.id,
			provider: PaymentProvider.STRIPE,
			providerRef: session.id,
			amount: request.feeCharged,
			status: PaymentStatus.PENDING,
		},
	});

	return { paymentId: created.id, checkoutUrl: session.url as string };
};

// WEBHOOK (API-29)
// rawBody MUST be the untouched request body Buffer — see app.ts, where
// this route is mounted with express.raw() before the global express.json().

const handleStripeWebhook = async (rawBody: Buffer, signature: string) => {
	let event: Stripe.Event;

	try {
		event = stripeClient.webhooks.constructEvent(
			rawBody,
			signature,
			config.stripe.webhook_secret,
		);
	} catch (err) {
		console.error("Stripe webhook signature verification failed:", err);
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid webhook signature");
	}

	if (event.type === "checkout.session.completed") {
		await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
	} else if (event.type === "checkout.session.expired") {
		await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
	}
	// Any other event type: acknowledged with 200 below, no action taken —
	// Stripe expects a 2xx for every event it sends, or it retries forever.

	return { received: true };
};

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
	const payment = await prisma.payment.findUnique({
		where: { providerRef: session.id },
		include: { request: true },
	});

	if (!payment) {
		// Unknown providerRef: log and return 200-equivalent rather than
		// throwing, so Stripe doesn't retry indefinitely for a session we
		// never created (e.g. a stray event from a different integration).
		console.error(`Webhook: no Payment found for session ${session.id}`);
		return;
	}

	// Idempotency (§10 / FR-017): duplicate callback on an already-COMPLETED
	// payment is a no-op.
	if (payment.status === PaymentStatus.COMPLETED) {
		return;
	}

	// Amount validation (§10): never silently accept a mismatch.
	const expectedUnitAmount = Math.round(Number(payment.amount) * 100);

	if (session.amount_total !== expectedUnitAmount) {
		console.error(
			`Webhook: amount mismatch for payment ${payment.id} — expected ${expectedUnitAmount}, got ${session.amount_total}`,
		);
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED },
		});
		return;
	}

	const request = payment.request;

	// Payment status + ServiceRequest status change atomically (§10).
	await prisma.$transaction([
		prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
		}),
		prisma.serviceRequest.update({
			where: { id: request.id },
			data: { status: RequestStatus.SUBMITTED },
		}),
		prisma.statusHistory.create({
			data: {
				requestId: request.id,
				fromStatus: RequestStatus.PENDING_PAYMENT,
				toStatus: RequestStatus.SUBMITTED,
				changedBy: request.citizenId,
				note: "Payment verified via webhook",
			},
		}),
	]);

	// TODO (Module G): send the payment-receipt email here — same
	// transport + ejs pattern already used in auth.service.ts.
};

const handleCheckoutExpired = async (session: Stripe.Checkout.Session) => {
	const payment = await prisma.payment.findUnique({ where: { providerRef: session.id } });

	if (!payment || payment.status !== PaymentStatus.PENDING) {
		return; // already handled, or not ours — no-op
	}

	await prisma.payment.update({
		where: { id: payment.id },
		data: { status: PaymentStatus.FAILED },
	});
	// ServiceRequest is left at PENDING_PAYMENT — re-payable via API-28.
};

// REFUND (FR-019) — called from request.service.ts's cancelServiceRequest.
// Returns null (no-op) if there's nothing eligible to refund.

const refundPaymentForRequest = async (requestId: string) => {
	const payment = await prisma.payment.findUnique({ where: { requestId } });

	if (!payment || payment.status !== PaymentStatus.COMPLETED) {
		return null;
	}

	const session = await stripeClient.checkout.sessions.retrieve(payment.providerRef);

	if (!session.payment_intent) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"No payment intent found for this session — cannot process refund",
		);
	}

	// Payment moves COMPLETED -> REFUNDED only after the provider confirms
	// the refund (§10) — we only update our row once this call succeeds.
	await stripeClient.refunds.create({
		payment_intent: session.payment_intent as string,
	});

	return prisma.payment.update({
		where: { id: payment.id },
		data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
	});
};

// GET SINGLE PAYMENT (API-30)

const getSinglePayment = async (paymentId: string, actor: IRequestUser) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			request: { select: { id: true, citizenId: true, trackingRef: true, title: true } },
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	if (actor.role === Role.STAFF) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have permission to view payments");
	}

	if (actor.role === Role.CITIZEN && payment.request.citizenId !== actor.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have permission to view this payment");
	}

	return payment;
};

// LIST PAYMENTS (API-31)

const ALLOWED_PAYMENT_SORT_FIELDS = ["createdAt", "amount", "status"];

const getAllPayments = async (query: IPaymentQuery, actor: IRequestUser) => {
	if (actor.role === Role.STAFF) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have permission to view payments");
	}

	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(Number(query.limit) > 0 ? Number(query.limit) : 10, 100);
	const skip = (page - 1) * limit;

	const sortBy = ALLOWED_PAYMENT_SORT_FIELDS.includes(query.sortBy as string)
		? (query.sortBy as string)
		: "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const where: Prisma.PaymentWhereInput = {
		...(actor.role === Role.CITIZEN ? { request: { citizenId: actor.userId } } : {}),
		...(query.status ? { status: query.status as PaymentStatus } : {}),
		...(query.provider ? { provider: query.provider as PaymentProvider } : {}),
	};

	const [items, total] = await Promise.all([
		prisma.payment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: { request: { select: { id: true, trackingRef: true, title: true } } },
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
	handleStripeWebhook,
	refundPaymentForRequest,
	getSinglePayment,
	getAllPayments,
};