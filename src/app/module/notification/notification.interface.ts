export type TNotificationType =
	| "REQUEST_STATUS_CHANGED"
	| "REQUEST_ASSIGNED"
	| "REQUEST_REASSIGNED"
	| "REQUEST_OVERDUE"
	| "PAYMENT_COMPLETED"
	| "PAYMENT_FAILED"
	| "FEEDBACK_RECEIVED";

export interface ICreateNotificationPayload {
	userId: string;
	type: TNotificationType;
	message: string;
}

export interface INotificationQuery {
	page?: number;
	limit?: number;
	isRead?: boolean;
}