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

export type TRequestForPayment = {
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

export interface IManualRefundPayload {
	reason?: string;
}
