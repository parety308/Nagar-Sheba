import { Router } from "express";
import { auth } from "../../middleware/auth";
import {
	loginLimiter,
	otpLimiter,
	otpVerifyLimiter,
} from "../../middleware/rateLimiter";
import { upload } from "../../middleware/upload";
import { validateRequestBody } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { authValidationSchemas } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	otpLimiter,
	validateRequestBody(authValidationSchemas.RegisterUserZodSchema),
	AuthController.registerUser,
);

router.post(
	"/verify-email",
	otpVerifyLimiter,
	validateRequestBody(authValidationSchemas.CitizenEmailVerifyZodSchema),
	AuthController.verifyCitizenEmail,
);

router.post(
	"/google-login",
	validateRequestBody(authValidationSchemas.GoogleLoginZodSchema),
	AuthController.googleLogin,
);

router.post(
	"/login",
	loginLimiter,
	validateRequestBody(authValidationSchemas.LoginUserZodSchema),
	AuthController.loginUser,
);

router.post(
	"/forgot-password",
	otpLimiter,
	validateRequestBody(authValidationSchemas.ForgotPasswordZodSchema),
	AuthController.forgotPassword,
);

router.post(
	"/reset-password",
	otpVerifyLimiter,
	validateRequestBody(authValidationSchemas.ResetPasswordZodSchema),
	AuthController.resetPassword,
);

router.get("/me", auth(), AuthController.getMe);

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

router.post("/logout", AuthController.logoutUser);

router.patch(
	"/me",
	auth(),
	validateRequestBody(authValidationSchemas.UpdateProfileZodSchema),
	AuthController.updateMyProfile,
);

router.post(
	"/change-password",
	auth(),
	validateRequestBody(authValidationSchemas.ChangePasswordZodSchema),
	AuthController.changePassword,
);

export const AuthRoutes = router;
