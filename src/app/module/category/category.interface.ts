export type TFeeType = "FREE" | "PAID";

export interface ICreateCategoryPayload {
	departmentId: string;
	name: string;
	feeType: TFeeType;
	feeAmount?: number;
	slaHours: number;
}

export interface IUpdateCategoryPayload {
	name?: string;
	feeType?: TFeeType;
	feeAmount?: number;
	slaHours?: number;
	isActive?: boolean;
}

export interface ICategoryQuery {
	page?: number;
	limit?: number;
	departmentId?: string;
	includeInactive?: boolean; // Admin only — also returns inactive/soft-deleted categories
}
