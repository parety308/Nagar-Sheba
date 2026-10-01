import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth, optionalAuth } from "../../middleware/auth";
import { validateRequestBody } from "../../middleware/validateRequest";
import { CategoryController } from "./category.controller";
import { categoryValidationSchemas } from "./category.validation";

const router = Router();

// anyone can show
router.get("/", optionalAuth, CategoryController.getAllCategories);
router.get("/:id", optionalAuth, CategoryController.getSingleCategory);

// Admin only Write values
router.post(
	"/",
	auth(Role.ADMIN),
	validateRequestBody(categoryValidationSchemas.CreateCategoryZodSchema),
	CategoryController.createCategory,
);

router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequestBody(categoryValidationSchemas.UpdateCategoryZodSchema),
	CategoryController.updateCategory,
);

router.delete("/:id", auth(Role.ADMIN), CategoryController.deleteCategory);

export const CategoryRoutes = router;
