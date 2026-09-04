import * as z from "zod";

const InitiatePaymentZodSchema = z.object({
	requestId: z.uuid("requestId must be a valid UUID"),
	provider: z.enum(
		["SSLCOMMERZ", "BKASH"],
		"provider must be SSLCOMMERZ or BKASH",
	),
});

const ManualRefundZodSchema = z.object({
	reason: z
		.string("reason must be a string")
		.max(500, "reason must not exceed 500 characters")
		.optional(),
});

export const paymentValidationSchemas = {
	InitiatePaymentZodSchema,
	ManualRefundZodSchema,
};
