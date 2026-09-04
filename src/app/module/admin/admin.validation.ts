import * as z from "zod";

// PROVISION STAFF / ADMIN

const ProvisionStaffZodSchema = z
	.object({
		fullName: z
			.string("Full name is required")
			.min(2, "Full name must be at least 2 characters long")
			.max(100, "Full name must not exceed 100 characters"),

		personalEmail: z.email("Please provide a valid personal email address."),

		organizationEmail: z.email(
			"Please provide a valid organization email address.",
		),

		role: z.enum(["STAFF", "ADMIN"], "role must be STAFF or ADMIN"),

		departmentId: z.uuid("departmentId must be a valid UUID").optional(),

		title: z
			.string("Title must be a string")
			.max(100, "Title must not exceed 100 characters")
			.optional(),
	})
	.refine((data) => (data.role === "STAFF" ? !!data.departmentId : true), {
		message: "departmentId is required when role is STAFF",
		path: ["departmentId"],
	});

// BLOCK / UNBLOCK ACCOUNT

const UpdateUserStatusZodSchema = z.object({
	status: z.enum(["ACTIVE", "BLOCKED"], "status must be ACTIVE or BLOCKED"),
});

export const adminValidationSchemas = {
	ProvisionStaffZodSchema,
	UpdateUserStatusZodSchema,
};