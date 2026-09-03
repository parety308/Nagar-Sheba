import { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../errors/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";
import { authValidationSchemas } from "./auth.validation";


const isProd = process.env.NODE_ENV === "production";
const accessTokenCookieOptions = {
	httpOnly: true,
	secure: isProd,
	sameSite: (isProd ? "none" : "lax") as "none" | "lax",
	maxAge: 1000 * 60 * 60 * 24,
};

const refreshTokenCookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "none" as const,
	maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};



const registerUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	await AuthService.registerUser(payload);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Check Your Email",
		data: null,
	});
});


const verifyCitizenEmail = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.verifyRegistrationEmail(payload);

	const { accessToken, refreshToken, user } = result;

	// Set Access Token Cookie
	res.cookie("accessToken", accessToken, accessTokenCookieOptions);

	// Set Refresh Token Cookie
	res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Citizen registered successfully",
		data: {
			user,
		},
	});
});


const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.googleLogin(payload);
	const { accessToken, refreshToken } = result;

	// Set access token cookie
	res.cookie("accessToken", accessToken, accessTokenCookieOptions);

	// Set refresh token cookie
	res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Google Login Successfully",
		data: {
			accessToken,
			refreshToken,
		},
	});
});


const loginUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.loginUser(payload);

	const { accessToken, refreshToken } = result;

	// Set access token cookie
	res.cookie("accessToken", accessToken, accessTokenCookieOptions);

	// Set refresh token cookie
	res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

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


const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User information is missing in the request");
	}

	const result = await AuthService.getMe(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const token = req.cookies.refreshToken;

	if (!token) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
	}

	const result = await AuthService.refreshToken(token);

	const { accessToken, refreshToken: newRefreshToken } = result;

	// Set new access token
	res.cookie("accessToken", accessToken, accessTokenCookieOptions);

	// Rotate refresh token
	res.cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions);

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

const logoutUser = catchAsync(async (req: Request, res: Response) => {
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

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.forgotPassword(payload);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.resetPassword(payload);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const updateProfileImage = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request",
		);
	}

	if (!req.file) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Profile image file is required",
		);
	}

	const parsed = authValidationSchemas.ProfileImageZodSchema.safeParse({
		mimetype: req.file.mimetype,
		size: req.file.size,
	});

	if (!parsed.success) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			parsed.error.issues.map((i) => i.message).join(", "),
		);
	}

	const result = await AuthService.updateProfileImage({
		userId: user.userId,
		file: req.file,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile image updated successfully",
		data: result,
	});
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request",
		);
	}

	const result = await AuthService.updateMyProfile(user, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile updated successfully",
		data: result,
	});
});

export const AuthController = {
	registerUser,
	googleLogin,
	loginUser,
	getMe,
	refreshToken,
	logoutUser,
	forgotPassword,
	resetPassword,
	verifyCitizenEmail,
	updateProfileImage,
	updateMyProfile
};
