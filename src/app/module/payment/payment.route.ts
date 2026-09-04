import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequestBody } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { paymentValidationSchemas } from "./payment.validation";

const router = Router();

// SSLCommerz callback endpoints — these are NOT behind auth(), since the
// caller is SSLCommerz's server (IPN) or the citizen's browser mid-redirect
// (success/fail/cancel), neither of which carries a Bearer token.
router.post("/ipn", PaymentController.handleIPN);
router.post("/success", PaymentController.handleSuccess);
router.post("/fail", PaymentController.handleFail);
router.post("/cancel", PaymentController.handleCancel);

router.post(
	"/initiate",
	auth(Role.CITIZEN),
	validateRequestBody(paymentValidationSchemas.InitiatePaymentZodSchema),
	PaymentController.initiatePayment,
);

router.get("/:id", auth(), PaymentController.getSinglePayment);
router.get("/", auth(), PaymentController.getAllPayments);

export const PaymentRoutes = router;
