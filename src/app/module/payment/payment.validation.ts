import * as z from "zod";

const InitiatePaymentZodSchema = z.object({
	requestId: z.uuid("requestId must be a valid UUID"),
});

export const paymentValidationSchemas = {
	InitiatePaymentZodSchema,
};