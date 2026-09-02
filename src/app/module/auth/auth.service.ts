import bcrypt from "bcryptjs";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AccountStatus,
	AuthProvider,
	Role,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import {
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterUserPayload,
	IRequestUser,
} from "./auth.interface";

// REGISTER USER

const registerUser = async (payload: IRegisterUserPayload) => {
	const { fullName, email: rawEmail, password, phone, address } = payload;

	const email = rawEmail.trim().toLowerCase();

	// Check existing user

	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (existingUser) {
		throw new Error("User with this email already exists");
	}

	// Hash password

	const passwordHash = await bcrypt.hash(password, 10);

	// Create User + Citizen Profile

	const createdUser = await prisma.user.create({
		data: {
			email,
			passwordHash,

			role: Role.CITIZEN,
			status: AccountStatus.ACTIVE,

			isEmailVerified: false,
			mustChangePassword: false,

			citizenProfile: {
				create: {
					fullName,
					phone,
					address,
				},
			},
		},

		include: {
			citizenProfile: true,
		},
	});

	// JWT Payload

	const jwtPayload = {
		userId: createdUser.id,
		name: createdUser.citizenProfile?.fullName,
		email: createdUser.email,
		role: createdUser.role,
	};

	// Access Token

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// Refresh Token

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	// Remove sensitive information

	const { passwordHash: _, ...safeUser } = createdUser;

	return {
		user: safeUser,
		accessToken,
		refreshToken,
	};
};

// LOGIN USER

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;

	const email = payload.email.trim().toLowerCase();

	// Find user

	const user = await prisma.user.findUnique({
		where: {
			email,
		},

		include: {
			citizenProfile: true,
			staffProfile: true,
			adminProfile: true,
		},
	});

	if (!user) {
		throw new Error("Invalid credentials");
	}

	// Check account status

	if (user.status === AccountStatus.BLOCKED) {
		throw new Error("User account is blocked");
	}

	// Password check

	if (!user.passwordHash) {
		throw new Error(
			"Password authentication is not available for this account",
		);
	}

	const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	// JWT Payload

	const jwtPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
	};

	// Access Token

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// Refresh Token

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

		include: {
			citizenProfile: true,
			staffProfile: {
				include: {
					department: true,
				},
			},
			adminProfile: true,
		},
	});

	// User not found

	if (!currentUser) {
		throw new Error("User not found");
	}

	// Check account status

	if (currentUser.status === AccountStatus.BLOCKED) {
		throw new Error("User account is blocked");
	}

	// Remove password hash

	const { passwordHash: _, ...safeUser } = currentUser;

	return safeUser;
};

// REFRESH TOKEN

const refreshToken = async (token: string) => {
	// Verify refresh token

	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	// Validate userId

	if (!data.userId) {
		throw new Error("Invalid refresh token payload");
	}

	// Find user

	const user = await prisma.user.findUnique({
		where: {
			id: data.userId,
		},
	});

	if (!user) {
		throw new Error("User not found");
	}

	// Check account status

	if (user.status === AccountStatus.BLOCKED) {
		throw new Error("User account is blocked");
	}

	// JWT Payload

	const jwtPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
	};

	// New Access Token

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// Rotate Refresh Token

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

//GOOGLE lOGIN
const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;

	try {
		// Verify Google ID Token
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();

		if (!googleIdTokenPayload) {
			throw new Error("Invalid or Expired Google ID Token");
		}

		if (!googleIdTokenPayload.email) {
			throw new Error("Email not found");
		}

		if (!googleIdTokenPayload.name) {
			throw new Error("Name not found");
		}

		// Find existing Google user
		let user = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
			},
			include: {
				citizenProfile: true,
			},
		});

		if (user) {
			// Check role
			if (user.role !== Role.CITIZEN) {
				throw new Error("This email is not registered as a citizen");
			}

			// Check blocked
			if (user.status === AccountStatus.BLOCKED) {
				throw new Error("User is Blocked");
			}

			// Existing credential account → link Google
			if (!user.googleId) {
				user = await prisma.user.update({
					where: {
						email: googleIdTokenPayload.email,
					},
					data: {
						googleId: googleIdTokenPayload.sub,
						isEmailVerified: true,
					},
					include: {
						citizenProfile: true,
					},
				});
			}
		} else {
			// No account → create new Google account
			user = await prisma.user.create({
				data: {
					email: googleIdTokenPayload.email,
					role: Role.CITIZEN,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					isEmailVerified: true,
					citizenProfile: {
						create: {
							fullName: googleIdTokenPayload.name,
						},
					},
				},
				include: {
					citizenProfile: true,
				},
			});
		}

		// JWT Payload
		const jwtPayload = {
			userId: user.id,
			name: user.citizenProfile?.fullName,
			email: user.email,
			role: user.role,
		};

		// Access Token
		const accessToken = jwtUtils.createToken(
			jwtPayload,
			config.jwt_access_secret,
			config.jwt_access_expires_in as SignOptions,
		);

		// Refresh Token
		const refreshToken = jwtUtils.createToken(
			jwtPayload,
			config.jwt_refresh_secret,
			config.jwt_refresh_expires_in as SignOptions,
		);

		return {
			accessToken,
			refreshToken,
		};
	} catch (error) {
		console.log("Google Login Failed:", error);

		throw error;
	}
};

// EXPORT

export const AuthService = {
	registerUser,
	googleLogin,
	loginUser,
	getMe,
	refreshToken,
};
