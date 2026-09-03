import * as z from "zod";

//create department
const CreateDepartmentZodSchema = z.object({
	name: z
		.string("Department name is required")
		.min(2, "Department name must be at least 2 characters long")
		.max(100, "Department name must not exceed 100 characters"),

	description: z
		.string("Description must be a string")
		.max(500, "Description must not exceed 500 characters")
		.optional(),
});

//update department
const UpdateDepartmentZodSchema = z
	.object({
		name: z
			.string("Department name must be a string")
			.min(2, "Department name must be at least 2 characters long")
			.max(100, "Department name must not exceed 100 characters")
			.optional(),

		description: z
			.string("Description must be a string")
			.max(500, "Description must not exceed 500 characters")
			.optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided to update.",
	});

export const departmentValidationSchemas = {
	CreateDepartmentZodSchema,
	UpdateDepartmentZodSchema,
};
