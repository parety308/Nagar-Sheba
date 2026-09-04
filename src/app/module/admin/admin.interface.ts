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
