export interface ICreateServiceRequestPayload {
	categoryId: string;
	title: string;
	description: string;
	address: string;
	latitude: number;
	longitude: number;
}

export interface ICreateServiceRequestServicePayload
	extends ICreateServiceRequestPayload {
	citizenId: string;
	files?: Express.Multer.File[];
}

export interface IRequestQuery {
	page?: number;
	limit?: number;
	status?: string;
	departmentId?: string;
	categoryId?: string;
	overdue?: boolean;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface ISearchRequestQuery {
	page?: number;
	limit?: number;
}
