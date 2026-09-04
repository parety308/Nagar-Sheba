import * as z from "zod";

const CreateServiceRequestZodSchema = z.object({
	categoryId: z.uuid("categoryId must be a valid UUID"),

	title: z
		.string("Title is required")
		.min(5, "Title must be at least 5 characters long")
		.max(150, "Title must not exceed 150 characters"),

	description: z
		.string("Description is required")
		.min(20, "Description must be at least 20 characters long")
		.max(2000, "Description must not exceed 2000 characters"),

	address: z
		.string("Address is required")
		.min(5, "Address must be at least 5 characters long")
		.max(255, "Address must not exceed 255 characters"),

	latitude: z.coerce
		.number("Latitude must be a number")
		.min(-90, "Latitude must be between -90 and 90")
		.max(90, "Latitude must be between -90 and 90"),

	longitude: z.coerce
		.number("Longitude must be a number")
		.min(-180, "Longitude must be between -180 and 180")
		.max(180, "Longitude must be between -180 and 180"),
});

export const requestValidationSchemas = {
	CreateServiceRequestZodSchema,
};
