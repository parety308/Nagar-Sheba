import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequestBody } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import { adminValidationSchemas } from "./admin.validation";

const router = Router();

router.post(
	"/staff",
	auth(Role.ADMIN),
	validateRequestBody(adminValidationSchemas.ProvisionStaffZodSchema),
	AdminController.provisionStaff,
);

router.patch(
	"/users/:id/status",
	auth(Role.ADMIN),
	validateRequestBody(adminValidationSchemas.UpdateUserStatusZodSchema),
	AdminController.updateUserStatus,
);

router.get("/audit-logs", auth(Role.ADMIN), AdminController.getAuditLogs);
router.get(
	"/dashboard-stats",
	auth(Role.ADMIN),
	AdminController.getDashboardStats,
);

export const AdminRoutes = router;
