import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import { TokenPayload } from "google-auth-library";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import path from "path";
import {
	AccountStatus,
	AuthProvider,
	Role,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { transport } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { jwtUtils } from "../../utils/jwt";
import {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterUserPayload,
	IRegistrationRedisPayload,
	IRegistrationVerifyPayload,
	IRequestUser,
	IResetPasswordPayload,
} from "./auth.interface";

// REGISTER USER

const registerUser = async (payload: IRegisterUserPayload) => {
	const { fullName, email: rawEmail, password, phone, address } = payload;

	// Normalize email
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

	// Data to store temporarily in Redis
	const redisPayload: IRegistrationRedisPayload = {
		fullName,
		email,
		passwordHash,
		phone,
		address,
	};

	// Generate 6 digit OTP
	const otpValue = crypto.randomInt(100000, 1000000);

	// Redis keys
	const otpKey = `citizen-registration-otp:${email}`;
	const registrationDataKey = `registration-data:${email}`;

	// OTP expires in 5 minutes
	await redisClient.set(otpKey, otpValue.toString(), {
		expiration: {
			type: "EX",
			value: 5 * 60,
		},
	});

	// Registration data expires in 5 minutes
	await redisClient.set(registrationDataKey, JSON.stringify(redisPayload), {
		expiration: {
			type: "EX",
			value: 5 * 60,
		},
	});

	// EJS template path
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-otp.ejs",
	);

	// Render email template
	const html = await ejs.renderFile(templatePath, {
		name: fullName,
		email,
		otpValue,
		expirationMinutes: 5,
	});

	// Send verification email
	await transport.sendMail({
		from: config.smtp.sender,
		to: email,
		subject: "Verify Email Address",
		html,
	});

	return {
		message:
			"Registration initiated. Please check your email for the verification code.",
	};
};

const verifyRegistrationEmail = async (payload: IRegistrationVerifyPayload) => {
	// Normalize email
	const email = payload.email.trim().toLowerCase();

	const otp = payload.otp.trim();

	// Check if user already exists
	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	// If user already verified
	if (existingUser?.isEmailVerified) {
		throw new Error("Email is already verified");
	}

	// If user is blocked
	if (existingUser?.status === "BLOCKED") {
		throw new Error("User is blocked");
	}

	// Redis OTP key
	const otpKey = `citizen-registration-otp:${email}`;

	// Get OTP from Redis
	const redisOTP = await redisClient.get(otpKey);

	// OTP not found / expired
	if (!redisOTP) {
		throw new Error("The verification code has expired or could not be found.");
	}

	// Compare OTP
	if (redisOTP !== otp) {
		throw new Error("The verification code is incorrect.");
	}

	// Registration data key
	const registrationDataKey = `registration-data:${email}`;

	// Get registration data from Redis
	const registrationData = await redisClient.get(registrationDataKey);

	if (!registrationData) {
		throw new Error("Registration data has expired or could not be found.");
	}

	// Parse Redis data
	const registrationPayload: IRegistrationRedisPayload =
		JSON.parse(registrationData);

	const {
		fullName,
		email: registrationEmail,
		passwordHash,
		phone,
		address,
	} = registrationPayload;

	// Extra safety check
	if (registrationEmail !== email) {
		throw new Error("Registration email does not match.");
	}

	// Create user + citizen profile
	const createdUser = await prisma.user.create({
		data: {
			email: registrationEmail,
			passwordHash,

			role: Role.CITIZEN,
			status: AccountStatus.ACTIVE,

			// OTP verified successfully
			isEmailVerified: true,

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

	// Create Access Token
	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// Create Refresh Token
	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	// Delete OTP and registration data after successful verification
	await redisClient.del(otpKey);
	await redisClient.del(registrationDataKey);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/welcome-registration.ejs",
	);

	const html = await ejs.renderFile(templatePath, {
		name: createdUser.citizenProfile?.fullName,
		email: createdUser.email,
	});

	await transport.sendMail({
		from: config.smtp.sender,
		to: createdUser.email,
		subject: "Welcome to Nagar Sheba",
		html,
	});

	// Remove passwordHash from response
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

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();

	// 1. Check user exists
	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!existingUser) {
		throw new Error("No account found with this email address.");
	}

	// 2. Check account status
	if (existingUser.status === AccountStatus.BLOCKED) {
		throw new Error(
			"Your account has been blocked. Please contact support for assistance.",
		);
	}

	// 3. Check authentication provider
	if (existingUser.authProvider !== AuthProvider.CREDENTIAL) {
		throw new Error(
			"This account does not use a password. Please sign in using your registered authentication provider.",
		);
	}

	// 4. Check email verification
	if (!existingUser.isEmailVerified) {
		throw new Error(
			"Your email address is not verified. Please verify your email before resetting your password.",
		);
	}

	// 5. Generate OTP
	const otp = crypto.randomInt(100000, 1000000);

	// 6. Store OTP in Redis for 5 minutes
	const key = `forgot-password:${email}`;

	await redisClient.set(key, otp.toString(), {
		expiration: {
			type: "EX",
			value: 5 * 60,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/forgot.password.ejs",
	);
	const html = await ejs.renderFile(templatePath, {
		otp,
	});
	transport.sendMail({
		from: config.smtp.sender,
		to: email,
		subject: "Forogot Password",
		html,
	});
	return {
		message:
			"A password reset verification code has been sent to your email address.",
	};
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();
	const { otp, newPassword } = payload;

	// 3. Find user
	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!existingUser) {
		throw new Error("No account found with this email address.");
	}

	// 4. Check account status
	if (existingUser.status === AccountStatus.BLOCKED) {
		throw new Error(
			"Your account has been blocked. Please contact support for assistance.",
		);
	}

	// 5. Check authentication provider
	if (existingUser.authProvider !== AuthProvider.CREDENTIAL) {
		throw new Error(
			"This account does not use a password. Please sign in using your registered authentication provider.",
		);
	}

	// 6. Check email verification
	if (!existingUser.isEmailVerified) {
		throw new Error(
			"Your email address is not verified. Please verify your email first.",
		);
	}

	// 7. Get OTP from Redis
	const key = `forgot-password:${email}`;

	const storedOtp = await redisClient.get(key);

	if (!storedOtp) {
		throw new Error(
			"OTP has expired or does not exist. Please request a new OTP.",
		);
	}

	// 8. Verify OTP
	if (storedOtp !== otp) {
		throw new Error("Invalid OTP. Please enter the correct OTP.");
	}

	// 9. Hash new password
	const hashedPassword = await bcrypt.hash(
		newPassword,
		config.bcrypt_salt_rounds,
	);

	// 10. Update password
	await prisma.user.update({
		where: {
			email,
		},
		data: {
			passwordHash: hashedPassword,
		},
	});

	// 11. Delete OTP after successful password reset
	await redisClient.del(key);

	// Render success email
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/reset.password.ejs",
	);

	const html = await ejs.renderFile(templatePath);

	// Send password-change notification
	await transport.sendMail({
		from: config.smtp.sender,
		to: email,
		subject: "Password Changed Successfully",
		html,
	});

	return {
		message: "Password reset successfully.",
	};
};
// EXPORT

export const AuthService = {
	registerUser,
	googleLogin,
	loginUser,
	getMe,
	refreshToken,
	forgotPassword,
	resetPassword,
	verifyRegistrationEmail,
};
