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

router.patch(
	"/:id/status",
	auth(Role.STAFF, Role.ADMIN),
	validateRequestBody(requestValidationSchemas.UpdateRequestStatusZodSchema),
	RequestController.transitionRequestStatus,
);

router.patch(
	"/:id/reassign",
	auth(Role.ADMIN),
	validateRequestBody(requestValidationSchemas.ReassignRequestZodSchema),
	RequestController.reassignRequest,
);

router.post(
	"/:id/reopen",
	auth(Role.CITIZEN),
	validateRequestBody(requestValidationSchemas.ReopenRequestZodSchema),
	RequestController.reopenRequest,
);

router.post(
	"/:id/attachments",
	auth(),
	upload.array("attachments", 5), // must run before validateRequestBody, same as create
	validateRequestBody(requestValidationSchemas.AddAttachmentZodSchema),
	RequestController.addAttachments,
);

export const RequestRoutes = router;
