import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { AppError } from "../errors/AppError";
import { prisma } from "../lib/prisma";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";


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



type TAccessTokenPayload = {
	userId: string;
	email: string;
	role: Role;
};

export const auth = (...requiredRoles: Role[]) => {
	return catchAsync(
		async (req: Request, _res: Response, next: NextFunction) => {
			

			const authHeader = req.headers.authorization;

			let token: string | undefined;

			if (authHeader) {
				if (authHeader.startsWith("Bearer ")) {
					token = authHeader.substring(7).trim();
				} else {
					token = authHeader.trim();
				}
			}


			if (!token) {
				token = req.cookies?.accessToken;
			}

			if (!token) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"You are not logged in. Please log in to access this resource.",
				);
			}


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



			if (!userId || !email || !role) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Invalid authentication token.",
				);
			}

		

			if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"You do not have permission to access this resource.",
				);
			}



			const user = await prisma.user.findUnique({
				where: { id: userId },
				include: {
					citizenProfile: true,
					staffProfile: true,
					adminProfile: true,
				},
			});

			if (!user) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"User not found. Please log in again.",
				);
			}

	
			if (user.deletedAt) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Your account has been deleted.",
				);
			}

			if (user.status === "BLOCKED") {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Your account has been blocked. Please contact support.",
				);
			}


			if (user.email !== email || user.role !== role) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Session is no longer valid. Please log in again.",
				);
			}



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

			next();
		},
	);
};
