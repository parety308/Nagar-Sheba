import * as z from "zod";

const ContactZodSchema = z.object({
	name: z.string("Name is required").min(2).max(100),
	email: z.email("Please provide a valid email address."),
	subject: z.string("Subject is required").min(5).max(150),
	message: z.string("Message is required").min(20).max(2000),
});

export const publicValidationSchemas = { ContactZodSchema };
