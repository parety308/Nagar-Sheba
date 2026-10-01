import { Router } from "express";
import { contactLimiter } from "../../middleware/rateLimiter";
import { validateRequestBody } from "../../middleware/validateRequest";
import { PublicController } from "./public.controller";
import { publicValidationSchemas } from "./public.validation";

const router = Router();

router.get("/stats", PublicController.getStats);
router.post(
	"/contact",
	contactLimiter,
	validateRequestBody(publicValidationSchemas.ContactZodSchema),
	PublicController.sendContactMessage,
);

export const PublicRoutes = router;
