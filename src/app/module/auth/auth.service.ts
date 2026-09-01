import bcrypt from "bcryptjs";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import {
	IRequestUser,
	ILoginUserPayload,
	IRegisterUserPayload,
} from "./auth.interface";


// REGISTER USER

const registerUser = async (payload: IRegisterUserPayload) => {
	const {
		name,
		password,
		phone,
		profileImage,
		address,
		gender,
	} = payload;

	const email = payload.email.trim().toLowerCase();

	// Check existing user
	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	// Hash password
	const hashedPassword = await bcrypt.hash(password, 10);

	// Create citizen
	const createdUser = await prisma.user.create({
		data: {
			name,
			email,
			password: hashedPassword,

			phone,
			profileImage,
			address,
			gender,

			role: Role.CITIZEN,
			status: UserStatus.ACTIVE,

			emailVerified: false,
			needPasswordChange: false,

			isDeleted: false,
		},

		omit: {
			password: true,
		},
	});

	// JWT payload
	const jwtPayload = {
		userId: createdUser.id,
		name: createdUser.name,
		email: createdUser.email,
		role: createdUser.role,
	};

	// Access token
	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// Refresh token
	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user: createdUser,
		accessToken,
		refreshToken,
	};
};



// LOGIN


const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	// Find user
	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new Error("Invalid credentials");
	}

	// Soft deleted user
	if (user.isDeleted) {
		throw new Error("User account has been deleted");
	}

	// Blocked user
	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	// Inactive user
	if (user.status === UserStatus.INACTIVE) {
		throw new Error("User account is inactive");
	}

	// Password verification
	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password,
	);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	// JWT payload
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	// Access token
	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// Refresh token
	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};



// GET CURRENT USER


const getMe = async (user: IRequestUser) => {
	const currentUser = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},

		omit: {
			password: true,
		},
	});

	if (!currentUser) {
		throw new Error("User not found");
	}

	if (currentUser.isDeleted) {
		throw new Error("User account has been deleted");
	}

	if (currentUser.status !== UserStatus.ACTIVE) {
		throw new Error("User account is not active");
	}

	return currentUser;
};



// REFRESH TOKEN


const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (
		!verifiedRefreshToken.success ||
		!verifiedRefreshToken.data
	) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	// Find user
	const user = await prisma.user.findUnique({
		where: {
			id: data.userId,
		},
	});

	if (!user) {
		throw new Error("User not found");
	}

	// Soft deleted
	if (user.isDeleted) {
		throw new Error("User account has been deleted");
	}

	// Inactive / blocked
	if (user.status !== UserStatus.ACTIVE) {
		throw new Error("User account is not active");
	}

	// JWT payload
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	// New access token
	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// New refresh token
	const newRefreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken: newRefreshToken,
	};
};


export const AuthService = {
	registerUser,
	loginUser,
	getMe,
	refreshToken,
};