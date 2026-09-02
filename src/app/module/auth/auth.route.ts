import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authValidationSchemas } from "./auth.validation";
import { validate } from "zod";
import { validateRequestBody } from "../../middleware/validateRequest";

const router = Router();

// AUTH ROUTES

// Register Citizen
router.post("/register",validateRequestBody(authValidationSchemas.RegisterUserZodSchema), AuthController.registerUser);

router.post("/google-login",validateRequestBody(authValidationSchemas.GoogleLoginZodSchema), AuthController.googleLogin);
// Login
router.post("/login", validateRequestBody(authValidationSchemas.LoginUserZodSchema),AuthController.loginUser);

// Get currently authenticated user
router.get("/me", AuthController.getMe);

// Refresh access + refresh token
router.post("/refresh-token", validateRequestBody(authValidationSchemas.RefreshTokenZodSchema),AuthController.refreshToken);

// Logout
router.post("/logout", AuthController.logoutUser);

export const AuthRoutes = router;
