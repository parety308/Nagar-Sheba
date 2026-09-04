import * as z from "zod";

const CreateFeedbackZodSchema = z.object({
	requestId: z.uuid("requestId must be a valid UUID"),
	rating: z
		.number("Rating must be a number")
		.int("Rating must be a whole number")
		.min(1, "Rating must be at least 1")
		.max(5, "Rating must not exceed 5"),
	comment: z
		.string("Comment must be a string")
		.max(1000, "Comment must not exceed 1000 characters")
		.optional(),
});

export const feedbackValidationSchemas = {
	CreateFeedbackZodSchema,
};