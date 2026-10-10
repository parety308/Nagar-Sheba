import config from "../config";

// sslcommerz-lts ships no type declarations, and Vercel's build ignores
// ambient .d.ts files. Suppress the error here and type the client ourselves.
// @ts-ignore
import SSLCommerzPaymentRaw from "sslcommerz-lts";

export interface SSLCommerzClient {
	init(data: Record<string, unknown>): Promise<{
		status: string;
		GatewayPageURL?: string;
		failedreason?: string;
		sessionkey?: string;
		tran_id?: string;
	}>;

	validate(data: Record<string, unknown>): Promise<{
		status?: string;
		amount?: string;
		currency?: string;
		tran_id?: string;
	}>;

	transactionQueryByTransactionId(data: Record<string, unknown>): Promise<{
		status?: string;
		errorReason?: string;
		element?: { bank_tran_id?: string; tran_id?: string; status?: string }[];
	}>;

	initiateRefund(data: Record<string, unknown>): Promise<{
		status: string;
		errorReason?: string;
		bank_tran_id?: string;
		refund_ref_id?: string;
	}>;

	refundQuery(data: Record<string, unknown>): Promise<unknown>;
}

export const createSSLCommerzInstance = (): SSLCommerzClient =>
	new (SSLCommerzPaymentRaw as any)(
		config.sslcommerz.store_id,
		config.sslcommerz.store_password,
		config.sslcommerz.is_live,
	) as SSLCommerzClient;