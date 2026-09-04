export type TStaffProvisionRole = "STAFF" | "ADMIN";

export interface IProvisionStaffPayload {
	fullName: string;
	personalEmail: string;
	organizationEmail: string;
	role: TStaffProvisionRole;
	departmentId?: string; // required when role === "STAFF"
	title?: string; // optional, Staff only
}

export interface IUpdateUserStatusPayload {
	status: "ACTIVE" | "BLOCKED";
}

export interface IAuditLogQuery {
	page?: number;
	limit?: number;
	entityType?: string;
	actorId?: string;
}

// NEW

export interface IUserListQuery {
	page?: number;
	limit?: number;
	role?: "CITIZEN" | "STAFF" | "ADMIN";
	status?: "ACTIVE" | "BLOCKED";
	search?: string; // matches email (contains, case-insensitive)
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface IUpdateUserRolePayload {
	role: "STAFF" | "ADMIN";
	departmentId?: string; // required when the new role is STAFF
	title?: string; // optional, carried over/set on the new StaffProfile
}