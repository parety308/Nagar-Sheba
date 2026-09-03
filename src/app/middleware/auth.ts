import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { AppError } from "../errors/AppError";
import { prisma } from "../lib/prisma";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

// Express Request type augmentation

declare global {
	namespace Express {
		interface Request {
			user?: {
				name: string;
				userId: string;
				email: string;
				role: Role;
			};
		}
	}
}

// JWT Access Token Payload

type TAccessTokenPayload = {
	userId: string;
	email: string;
	role: Role;
};

export const auth = (...requiredRoles: Role[]) => {
	return catchAsync(
		async (req: Request, _res: Response, next: NextFunction) => {
			// 1. Get access token

			const authHeader = req.headers.authorization;

			let token: string | undefined;

			// Authorization: Bearer <token>
			if (authHeader) {
				if (authHeader.startsWith("Bearer ")) {
					token = authHeader.substring(7).trim();
				} else {
					token = authHeader.trim();
				}
			}

			// Fallback: Cookie
			if (!token) {
				token = req.cookies?.accessToken;
			}

			if (!token) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"You are not logged in. Please log in to access this resource.",
				);
			}

			// 2. Verify JWT

			const verifiedToken = jwtUtils.verifyToken(
				token,
				config.jwt_access_secret,
			);

			if (!verifiedToken.success) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					verifiedToken.error ||
						"Invalid or expired token. Please log in again.",
				);
			}

			const payload = verifiedToken.data as TAccessTokenPayload;

			const { userId, email, role } = payload;

			// 3. Validate JWT payload

			if (!userId || !email || !role) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Invalid authentication token.",
				);
			}

			// 4. Role authorization

			if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"You do not have permission to access this resource.",
				);
			}

			// 5. Get current user from database

			const user = await prisma.user.findUnique({
				where: { id: userId },
				include: {
					citizenProfile: true,
					staffProfile: true,
					adminProfile: true,
				},
			});

			// User doesn't exist
			if (!user) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"User not found. Please log in again.",
				);
			}

			// 6. Account status checks

			// Soft deleted user
			if (user.deletedAt) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Your account has been deleted.",
				);
			}

			// Blocked user
			if (user.status === "BLOCKED") {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Your account has been blocked. Please contact support.",
				);
			}

			// 7. Verify JWT identity against database

			if (user.email !== email || user.role !== role) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Session is no longer valid. Please log in again.",
				);
			}

			// 8. Attach trusted user information to request

			req.user = {
				name:
					user.citizenProfile?.fullName ??
					user.staffProfile?.fullName ??
					user.adminProfile?.fullName ??
					"User",
				userId: user.id,
				email: user.email,
				role: user.role,
			};

			// 9. Continue

			next();
		},
	);
};
