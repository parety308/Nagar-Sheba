import * as z from "zod";
import { RequestStatus } from "../../../generated/prisma/enums";

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

const requestStatusValues = Object.values(RequestStatus) as [
	string,
	...string[],
];

const UpdateRequestStatusZodSchema = z.object({
	toStatus: z.enum(
		requestStatusValues,
		"toStatus must be a valid request status",
	),
	note: z
		.string("note must be a string")
		.max(1000, "note must not exceed 1000 characters")
		.optional(),
});

const ReassignRequestZodSchema = z
	.object({
		staffId: z.uuid("staffId must be a valid UUID").optional(),
		departmentId: z.uuid("departmentId must be a valid UUID").optional(),
		reason: z
			.string("reason must be a string")
			.max(500, "reason must not exceed 500 characters")
			.optional(),
	})
	.refine((data) => !!data.staffId || !!data.departmentId, {
		message: "Provide either staffId or departmentId",
	});

const ReopenRequestZodSchema = z.object({
	reason: z
		.string("A reason is required to reopen a request")
		.min(5, "Reason must be at least 5 characters long")
		.max(500, "Reason must not exceed 500 characters"),
});

const AddAttachmentZodSchema = z.object({
	type: z
		.enum(
			["EVIDENCE", "RESOLUTION_PROOF"],
			"type must be EVIDENCE or RESOLUTION_PROOF",
		)
		.optional(),
});

export const requestValidationSchemas = {
	CreateServiceRequestZodSchema,
	UpdateRequestStatusZodSchema,
	ReassignRequestZodSchema,
	ReopenRequestZodSchema,
	AddAttachmentZodSchema,
};
