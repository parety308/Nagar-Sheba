import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { validateRequestBody } from "../../middleware/validateRequest";
import { RequestController } from "./request.controller";
import { requestValidationSchemas } from "./request.validation";

const router = Router();

router.post(
	"/",
	auth(Role.CITIZEN),
	upload.array("attachments", 5),
	validateRequestBody(requestValidationSchemas.CreateServiceRequestZodSchema),
	RequestController.createServiceRequest,
);

router.get("/search", auth(), RequestController.searchServiceRequests);

router.get("/", auth(), RequestController.getAllServiceRequests);
router.get("/:id", auth(), RequestController.getSingleServiceRequest);

router.post(
	"/:id/cancel",
	auth(Role.CITIZEN),
	RequestController.cancelServiceRequest,
);

export const RequestRoutes = router;
