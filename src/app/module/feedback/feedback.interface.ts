export interface ICreateFeedbackPayload {
	requestId: string;
	citizenId: string;
	rating: number;
	comment?: string;
}

export interface IFeedbackQuery {
	page?: number;
	limit?: number;
	rating?: number;
	departmentId?: string;
}
