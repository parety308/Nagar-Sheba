
import { Router } from "express";

import { Role } from "../../../generated/prisma/enums";

import { auth } from "../../middleware/checkAuth";

import { AuthController } from "./auth.controller";

const router = Router();


// PUBLIC ROUTES

// Register new citizen
router.post(
	"/register",
	AuthController.registerUser,
);

// Login
router.post(
	"/login",
	AuthController.loginUser,
);

// Generate new access token
router.post(
	"/refresh-token",
	AuthController.refreshToken,
);


// PROTECTED ROUTES

// Get current authenticated user
router.get(
	"/me",
	auth(
		Role.CITIZEN,
		Role.STAFF,
		Role.ADMIN,
	),
	AuthController.getMe,
);


export const AuthRoutes = router;

