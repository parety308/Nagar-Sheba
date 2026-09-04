import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequestBody } from "../../middleware/validateRequest";
import { FeedbackController } from "./feedback.controller";
import { feedbackValidationSchemas } from "./feedback.validation";

const router = Router();

router.post(
	"/",
	auth(Role.CITIZEN),
	validateRequestBody(feedbackValidationSchemas.CreateFeedbackZodSchema),
	FeedbackController.createFeedback,
);

router.get("/", auth(), FeedbackController.getAllFeedbacks);
router.get("/:requestId", auth(), FeedbackController.getSingleFeedback);

export const FeedbackRoutes = router;