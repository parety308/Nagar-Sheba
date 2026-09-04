import * as z from "zod";

const InitiatePaymentZodSchema = z.object({
	requestId: z.uuid("requestId must be a valid UUID"),
	provider: z.enum(
		["SSLCOMMERZ", "BKASH"],
		"provider must be SSLCOMMERZ or BKASH",
	),
});

export const paymentValidationSchemas = {
	InitiatePaymentZodSchema,
};
