import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequestBody } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { paymentValidationSchemas } from "./payment.validation";

const router = Router();

// NOTE: the webhook (API-29) is NOT registered here — it's mounted
// directly in app.ts, before express.json(), since Stripe's signature
// check needs the raw body. See app.ts.

router.post(
	"/initiate",
	auth(Role.CITIZEN),
	validateRequestBody(paymentValidationSchemas.InitiatePaymentZodSchema),
	PaymentController.initiatePayment,
);

router.get("/:id", auth(), PaymentController.getSinglePayment);
router.get("/", auth(), PaymentController.getAllPayments);

export const PaymentRoutes = router;