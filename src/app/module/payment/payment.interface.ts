export interface IInitiatePaymentPayload {
	requestId: string;
	provider: "SSLCOMMERZ" | "BKASH";
}

export interface IPaymentQuery {
	page?: number;
	limit?: number;
	status?: string;
	provider?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}