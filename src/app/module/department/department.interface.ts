export interface ICreateDepartmentPayload {
	name: string;
	description?: string;
}

export interface IUpdateDepartmentPayload {
	name?: string;
	description?: string;
}

export interface IDepartmentQuery {
	page?: number;
	limit?: number;
	includeInactive?: boolean;
}
