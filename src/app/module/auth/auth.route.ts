import { Router } from "express";
import { AuthController } from "./auth.controller";

const router = Router();

// AUTH ROUTES

// Register Citizen
router.post("/register", AuthController.registerUser);

router.post("/google-login", AuthController.googleLogin);
// Login
router.post("/login", AuthController.loginUser);

// Get currently authenticated user
router.get("/me", AuthController.getMe);

// Refresh access + refresh token
router.post("/refresh-token", AuthController.refreshToken);

// Logout
router.post("/logout", AuthController.logoutUser);

export const AuthRoutes = router;
