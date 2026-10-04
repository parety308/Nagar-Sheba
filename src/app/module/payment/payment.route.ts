import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequestBody } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { paymentValidationSchemas } from "./payment.validation";

const router = Router();

router.post("/sslcommerz/ipn", PaymentController.handleSSLCommerzIPN);
router.all("/sslcommerz/success", PaymentController.handleSSLCommerzSuccess);
router.all("/sslcommerz/fail", PaymentController.handleSSLCommerzFail);
router.all("/sslcommerz/cancel", PaymentController.handleSSLCommerzCancel);

router.post(
	"/initiate",
	auth(Role.CITIZEN),
	validateRequestBody(paymentValidationSchemas.InitiatePaymentZodSchema),
	PaymentController.initiatePayment,
);

router.patch(
	"/:id/refund",
	auth(Role.ADMIN),
	validateRequestBody(paymentValidationSchemas.ManualRefundZodSchema),
	PaymentController.manualRefundPayment,
);

router.get("/:id", auth(), PaymentController.getSinglePayment);
router.get(
	"/:id/receipt",
	auth(Role.CITIZEN, Role.ADMIN),
	PaymentController.downloadReceipt,
);
router.get("/", auth(), PaymentController.getAllPayments);
router.get("/bkash/callback", PaymentController.handleBkashCallback);

export const PaymentRoutes = router;
