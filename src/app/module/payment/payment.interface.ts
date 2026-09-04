export interface IInitiatePaymentPayload {
	requestId: string;
}

export interface IPaymentQuery {
	page?: number;
	limit?: number;
	status?: string;
	provider?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}