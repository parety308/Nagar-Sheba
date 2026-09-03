import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequestBody } from "../../middleware/validateRequest";
import { DepartmentController } from "./department.controller";
import { departmentValidationSchemas } from "./department.validation";

const router = Router();




router.get("/", auth(), DepartmentController.getAllDepartments);
router.get("/:id", auth(), DepartmentController.getSingleDepartment);


// admin only writes
router.post(
	"/",
	auth(Role.ADMIN),
	validateRequestBody(departmentValidationSchemas.CreateDepartmentZodSchema),
	DepartmentController.createDepartment,
);

router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequestBody(departmentValidationSchemas.UpdateDepartmentZodSchema),
	DepartmentController.updateDepartment,
);

router.delete("/:id", auth(Role.ADMIN), DepartmentController.deleteDepartment);

export const DepartmentRoutes = router;
