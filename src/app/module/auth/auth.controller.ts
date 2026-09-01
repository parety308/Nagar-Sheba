
import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";

// COOKIE OPTIONS

const accessTokenCookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "none" as const,
	maxAge: 1000 * 60 * 60 * 24, // 1 day
};

const refreshTokenCookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "none" as const,
	maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};

// REGISTER USER

const registerUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.registerUser(payload);

	const { accessToken, refreshToken, user } = result;

	// Set access token cookie
	res.cookie(
		"accessToken",
		accessToken,
		accessTokenCookieOptions,
	);

	// Set refresh token cookie
	res.cookie(
		"refreshToken",
		refreshToken,
		refreshTokenCookieOptions,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "User registered successfully",
		data: {
			user,
			accessToken,
			refreshToken,
		},
	});
});

// LOGIN USER

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.loginUser(payload);

	const { accessToken, refreshToken } = result;

	// Set access token cookie
	res.cookie(
		"accessToken",
		accessToken,
		accessTokenCookieOptions,
	);

	// Set refresh token cookie
	res.cookie(
		"refreshToken",
		refreshToken,
		refreshTokenCookieOptions,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: {
			accessToken,
			refreshToken,
		},
	});
});

// GET CURRENT USER

const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	if (!user) {
		throw new Error("User information is missing in the request");
	}

	const result = await AuthService.getMe(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

// REFRESH TOKEN

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const token = req.cookies.refreshToken;

	if (!token) {
		throw new Error("Refresh token is missing");
	}

	const result = await AuthService.refreshToken(token);

	const {
		accessToken,
		refreshToken: newRefreshToken,
	} = result;

	// Set new access token
	res.cookie(
		"accessToken",
		accessToken,
		accessTokenCookieOptions,
	);

	// Rotate refresh token
	res.cookie(
		"refreshToken",
		newRefreshToken,
		refreshTokenCookieOptions,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: {
			accessToken,
			refreshToken: newRefreshToken,
		},
	});
});

// LOGOUT USER

const logoutUser = catchAsync(async (_req: Request, res: Response) => {
	// Clear authentication cookies
	res.clearCookie("accessToken", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "none" as const,
	});

	res.clearCookie("refreshToken", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "none" as const,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged out successfully",
		data: null,
	});
});

// EXPORT

export const AuthController = {
	registerUser,
	loginUser,
	getMe,
	refreshToken,
	logoutUser,
};

