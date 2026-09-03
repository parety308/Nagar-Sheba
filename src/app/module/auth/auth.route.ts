import { Router } from "express";
import { validate } from "zod";
import { auth } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { validateRequestBody } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { authValidationSchemas } from "./auth.validation";

const router = Router();

// AUTH ROUTES

// Register Citizen
router.post(
	"/register",
	validateRequestBody(authValidationSchemas.RegisterUserZodSchema),
	AuthController.registerUser,
);

router.post(
	"/verify-email",
	validateRequestBody(authValidationSchemas.CitizenEmailVerifyZodSchema),
	AuthController.verifyCitizenEmail,
);

router.post(
	"/google-login",
	validateRequestBody(authValidationSchemas.GoogleLoginZodSchema),
	AuthController.googleLogin,
);
// Login
router.post(
	"/login",
	validateRequestBody(authValidationSchemas.LoginUserZodSchema),
	AuthController.loginUser,
);

router.post(
	"/forgot-password",
	validateRequestBody(authValidationSchemas.ForgotPasswordZodSchema),
	AuthController.forgotPassword,
);

router.post(
	"/reset-password",
	validateRequestBody(authValidationSchemas.ResetPasswordZodSchema),
	AuthController.resetPassword,
);
// Get currently authenticated user
router.get("/me", auth(), AuthController.getMe);

// Refresh access + refresh token
router.post(
	"/refresh-token",
	validateRequestBody(authValidationSchemas.RefreshTokenZodSchema),
	AuthController.refreshToken,
);

router.patch(
	"/me/profile-image",
	auth(),
	upload.single("profileImage"),
	AuthController.updateProfileImage,
);

// Logout
router.post("/logout", AuthController.logoutUser);

export const AuthRoutes = router;
