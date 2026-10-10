import config from "../config";
import { redisClient } from "./redis";

const TOKEN_KEY = "bkash:id_token";

const grantToken = async (): Promise<string> => {
	const cached = await redisClient.get(TOKEN_KEY);

	if (cached) {
		return cached;
	}

	const res = await fetch(
		`${config.bkash.base_url}/tokenized/checkout/token/grant`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				username: config.bkash.username,
				password: config.bkash.password,
			},
			body: JSON.stringify({
				app_key: config.bkash.app_key,
				app_secret: config.bkash.app_secret,
			}),
		},
	);

	const data = await res.json();

	if (!res.ok || !data.id_token) {
		throw new Error(`bKash grant token failed: ${JSON.stringify(data)}`);
	}

	const ttl = Math.max(Number(data.expires_in ?? 3600) - 60, 60);

	await redisClient.set(TOKEN_KEY, data.id_token, {
		expiration: {
			type: "EX",
			value: ttl,
		},
	});

	return data.id_token;
};

const authHeaders = async () => ({
	"Content-Type": "application/json",
	Authorization: await grantToken(),
	"X-APP-Key": config.bkash.app_key,
});

export interface IBkashCreateResponse {
	statusCode: string;
	statusMessage: string;
	paymentID?: string;
	bkashURL?: string;
	amount?: string;
}

export interface IBkashExecuteResponse {
	statusCode: string;
	statusMessage: string;
	transactionStatus?: string;
	trxID?: string;
	paymentID?: string;
	amount?: string;
	currency?: string;
}

export const bkashClient = {
	createPayment: async (payload: {
		amount: number;
		invoiceNumber: string;
		callbackURL: string;
	}): Promise<IBkashCreateResponse> => {
		const res = await fetch(
			`${config.bkash.base_url}/tokenized/checkout/create`,
			{
				method: "POST",
				headers: await authHeaders(),
				body: JSON.stringify({
					mode: "0011",
					payerReference: payload.invoiceNumber,
					callbackURL: payload.callbackURL,
					amount: payload.amount.toFixed(2),
					currency: "BDT",
					intent: "sale",
					merchantInvoiceNumber: payload.invoiceNumber,
				}),
			},
		);

		return res.json();
	},

	executePayment: async (paymentID: string): Promise<IBkashExecuteResponse> => {
		const res = await fetch(
			`${config.bkash.base_url}/tokenized/checkout/execute`,
			{
				method: "POST",
				headers: await authHeaders(),
				body: JSON.stringify({
					paymentID,
				}),
			},
		);

		return res.json();
	},

	queryPayment: async (paymentID: string): Promise<IBkashExecuteResponse> => {
		const res = await fetch(
			`${config.bkash.base_url}/tokenized/checkout/payment/status`,
			{
				method: "POST",
				headers: await authHeaders(),
				body: JSON.stringify({
					paymentID,
				}),
			},
		);

		return res.json();
	},

	refundTransaction: async (payload: {
		paymentID: string;
		trxID: string;
		amount: number;
		reason: string;
		sku?: string;
	}) => {
		const res = await fetch(
			`${config.bkash.base_url}/tokenized/checkout/payment/refund`,
			{
				method: "POST",
				headers: await authHeaders(),
				body: JSON.stringify({
					paymentID: payload.paymentID,
					amount: payload.amount.toFixed(2),
					trxID: payload.trxID,
					sku: payload.sku ?? "service-fee",
					reason: payload.reason,
				}),
			},
		);

		return res.json();
	},
};
