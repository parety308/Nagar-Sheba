import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequestBody } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { paymentValidationSchemas } from "./payment.validation";

const router = Router();


router.post("/ipn", PaymentController.handleSSLCommerzIPN);
router.post("/success", PaymentController.handleSSLCommerzSuccess);
router.post("/fail", PaymentController.handleSSLCommerzFail);
router.post("/cancel", PaymentController.handleSSLCommerzCancel);

router.post(
	"/initiate",
	auth(Role.CITIZEN),
	validateRequestBody(paymentValidationSchemas.InitiatePaymentZodSchema),
	PaymentController.initiatePayment,
);

router.get("/:id", auth(), PaymentController.getSinglePayment);
router.get("/", auth(), PaymentController.getAllPayments);
router.get("/bkash/callback", PaymentController.handleBkashCallback);

export const PaymentRoutes = router;
