import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import path from "path";
import {
	AccountStatus,
	AuthProvider,
	Role,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { googleClient } from "../../lib/googleAuth";
import { transport } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { jwtUtils } from "../../utils/jwt";
import {
	deleteFromCloudinary,
	uploadBufferToCloudinary,
} from "../../utils/uploadToCloudinary";
import {
	IChangePasswordPayload,
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterUserPayload,
	IRegistrationRedisPayload,
	IRegistrationVerifyPayload,
	IRequestUser,
	IResetPasswordPayload,
	IUpdateProfileImagePayload,
	IUpdateProfilePayload,
} from "./auth.interface";

const registerUser = async (payload: IRegisterUserPayload) => {
	const { fullName, email: rawEmail, password, phone, address } = payload;

	const email = rawEmail.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"User with this email already exists",
		);
	}

	const passwordHash = await bcrypt.hash(password, config.bcrypt_salt_rounds);

	const redisPayload: IRegistrationRedisPayload = {
		fullName,
		email,
		passwordHash,
		phone,
		address,
	};

	const otpValue = crypto.randomInt(100000, 1000000);

	const otpKey = `citizen-registration-otp:${email}`;
	const registrationDataKey = `registration-data:${email}`;

	await redisClient.set(otpKey, otpValue.toString(), {
		expiration: {
			type: "EX",
			value: 5 * 60,
		},
	});

	await redisClient.set(registrationDataKey, JSON.stringify(redisPayload), {
		expiration: {
			type: "EX",
			value: 5 * 60,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-otp.ejs",
	);

	const html = await ejs.renderFile(templatePath, {
		name: fullName,
		email,
		otpValue,
		expirationMinutes: 5,
	});

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
	const email = payload.email.trim().toLowerCase();

	const otp = payload.otp.trim();

	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (existingUser?.isEmailVerified) {
		throw new AppError(httpStatus.BAD_REQUEST, "Email is already verified");
	}

	if (existingUser?.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	const otpKey = `citizen-registration-otp:${email}`;

	const redisOTP = await redisClient.get(otpKey);

	if (!redisOTP) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"The verification code has expired or could not be found.",
		);
	}

	if (redisOTP !== otp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"The verification code is incorrect.",
		);
	}

	const registrationDataKey = `registration-data:${email}`;

	const registrationData = await redisClient.get(registrationDataKey);

	if (!registrationData) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Registration data has expired or could not be found.",
		);
	}

	const registrationPayload: IRegistrationRedisPayload =
		JSON.parse(registrationData);

	const {
		fullName,
		email: registrationEmail,
		passwordHash,
		phone,
		address,
	} = registrationPayload;

	if (registrationEmail !== email) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Registration email does not match.",
		);
	}

	const createdUser = await prisma.user.create({
		data: {
			email: registrationEmail,
			passwordHash,

			role: Role.CITIZEN,
			status: AccountStatus.ACTIVE,

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

	const jwtPayload = {
		userId: createdUser.id,
		name: createdUser.citizenProfile?.fullName,
		email: createdUser.email,
		role: createdUser.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	await redisClient.del(otpKey);
	await redisClient.del(registrationDataKey);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/welcome-registration.ejs",
	);

	try {
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
	} catch (error) {
		console.error("Post-action email failed:", error);
	}

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
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User not found. Please log in again.",
		);
	}

	if (user.deletedAt) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted.");
	}

	if (user.status === AccountStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is blocked");
	}

	if (!user.passwordHash) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Password authentication is not available for this account",
		);
	}

	const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

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

	if (!currentUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (currentUser.status === AccountStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is blocked");
	}

	const { passwordHash: _, ...safeUser } = currentUser;

	return safeUser;
};

// REFRESH TOKEN

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development"
				? verifiedRefreshToken.error || "Invalid refresh token"
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	if (!data.userId) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid refresh token payload",
		);
	}

	const user = await prisma.user.findUnique({
		where: {
			id: data.userId,
		},
	});

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User not found");
	}

	if (user.deletedAt) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted.");
	}

	if (user.status === AccountStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is blocked");
	}

	const jwtPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

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
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();

		if (!googleIdTokenPayload) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"Invalid or Expired Google ID Token",
			);
		}

		if (!googleIdTokenPayload.email) {
			throw new AppError(httpStatus.BAD_REQUEST, "Email not found");
		}

		if (!googleIdTokenPayload.name) {
			throw new AppError(httpStatus.BAD_REQUEST, "Name not found");
		}

		let user = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
			},
			include: {
				citizenProfile: true,
			},
		});

		if (user) {
			if (user.role !== Role.CITIZEN) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"This email is not registered as a citizen",
				);
			}

			if (user.status === AccountStatus.BLOCKED) {
				throw new AppError(httpStatus.FORBIDDEN, "User is Blocked");
			}

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

		const jwtPayload = {
			userId: user.id,
			name: user.citizenProfile?.fullName,
			email: user.email,
			role: user.role,
		};

		const accessToken = jwtUtils.createToken(
			jwtPayload,
			config.jwt_access_secret,
			config.jwt_access_expires_in as SignOptions,
		);

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

const FORGOT_PASSWORD_MESSAGE =
	"If an account exists for this email, a reset code has been sent.";

const isResettable = (
	user: {
		deletedAt: Date | null;
		status: AccountStatus;
		authProvider: AuthProvider;
		isEmailVerified: boolean;
	} | null,
) =>
	!!user &&
	!user.deletedAt &&
	user.status !== AccountStatus.BLOCKED &&
	user.authProvider === AuthProvider.CREDENTIAL &&
	user.isEmailVerified;

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({
		where: { email },
	});

	// Same response whether or not the account exists
	if (!isResettable(existingUser)) {
		return { message: FORGOT_PASSWORD_MESSAGE };
	}

	const otp = crypto.randomInt(100000, 1000000);
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

	const html = await ejs.renderFile(templatePath, { otp });

	await transport.sendMail({
		from: config.smtp.sender,
		to: email,
		subject: "Forgot Password",
		html,
	});

	return { message: FORGOT_PASSWORD_MESSAGE };
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();
	const { otp, newPassword } = payload;

	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!isResettable(existingUser)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or expired verification code.",
		);
	}

	const key = `forgot-password:${email}`;

	const storedOtp = await redisClient.get(key);

	if (!storedOtp || storedOtp !== otp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or expired verification code.",
		);
	}

	const hashedPassword = await bcrypt.hash(
		newPassword,
		config.bcrypt_salt_rounds,
	);

	await prisma.user.update({
		where: {
			email,
		},
		data: {
			passwordHash: hashedPassword,
			mustChangePassword: false,
		},
	});

	await redisClient.del(key);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/reset.password.ejs",
	);

	try {
		const html = await ejs.renderFile(templatePath);

		await transport.sendMail({
			from: config.smtp.sender,
			to: email,
			subject: "Password Changed Successfully",
			html,
		});
	} catch (error) {
		console.error("Post-action email failed:", error);
	}

	return {
		message: "Password reset successfully.",
	};
};

const updateProfileImage = async (payload: IUpdateProfileImagePayload) => {
	const { userId, file } = payload;

	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.deletedAt) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted.");
	}

	if (user.status === AccountStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked.");
	}

	const uploadResult = await uploadBufferToCloudinary(
		file.buffer,
		"nagar-sheba/profile-images",
	);

	// remove the old image from Cloudinary, if any
	if (user.profileImagePublicId) {
		await deleteFromCloudinary(user.profileImagePublicId);
	}

	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			profileImage: uploadResult.secure_url,
			profileImagePublicId: uploadResult.public_id,
		},
	});

	const { passwordHash: _, ...safeUser } = updatedUser;

	return safeUser;
};

const updateMyProfile = async (
	user: IRequestUser,
	payload: IUpdateProfilePayload,
) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: user.userId },
	});

	if (!currentUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (currentUser.deletedAt) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted.");
	}

	if (currentUser.status === AccountStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked.");
	}

	switch (currentUser.role) {
		case Role.CITIZEN:
			await prisma.citizenProfile.update({
				where: { userId: user.userId },
				data: {
					fullName: payload.fullName,
					phone: payload.phone,
					address: payload.address,
				},
			});
			break;

		case Role.STAFF:
			await prisma.staffProfile.update({
				where: { userId: user.userId },
				data: {
					fullName: payload.fullName,
					title: payload.title,
				},
			});
			break;

		case Role.ADMIN:
			await prisma.adminProfile.update({
				where: { userId: user.userId },
				data: {
					fullName: payload.fullName,
				},
			});
			break;

		default:
			throw new AppError(httpStatus.BAD_REQUEST, "Unsupported role");
	}

	const updatedUser = await prisma.user.findUnique({
		where: { id: user.userId },
		include: {
			citizenProfile: true,
			staffProfile: { include: { department: true } },
			adminProfile: true,
		},
	});

	const { passwordHash: _, ...safeUser } = updatedUser!;

	return safeUser;
};


const DEMO_EMAILS = [
  config.demo_admin.email,
  config.demo_citizen.email,
  "staff.roads@nagar-sheba.com",
  "staff.waste@nagar-sheba.com",
  "staff.water@nagar-sheba.com",
  "staff.licensing@nagar-sheba.com",
].map((email) => email.toLowerCase());

const changePassword = async (
  user: IRequestUser,
  payload: IChangePasswordPayload,
) => {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
  });

  if (!dbUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Prevent changes to shared demo account passwords.
  if (DEMO_EMAILS.includes(dbUser.email.toLowerCase())) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Demo account passwords cannot be changed",
    );
  }

  if (!dbUser.passwordHash) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This account does not use a password.",
    );
  }

  const matches = await bcrypt.compare(
    payload.currentPassword,
    dbUser.passwordHash,
  );

  // 400 (not 401) so the frontend doesn't treat it as an expired session.
  if (!matches) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Current password is incorrect",
    );
  }

  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      passwordHash: await bcrypt.hash(
        payload.newPassword,
        config.bcrypt_salt_rounds,
      ),
      mustChangePassword: false,
    },
  });

  return { message: "Password changed successfully." };
};


const resendRegistrationOtp = async (rawEmail: string) => {
	const email = rawEmail.trim().toLowerCase();

	const dataKey = `registration-data:${email}`;
	const otpKey = `citizen-registration-otp:${email}`;
	const cooldownKey = `registration-resend-cooldown:${email}`;

	const stored = await redisClient.get(dataKey);
	if (!stored) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Registration session expired. Please register again.",
		);
	}

	if (await redisClient.get(cooldownKey)) {
		throw new AppError(
			httpStatus.TOO_MANY_REQUESTS,
			"Please wait a minute before requesting another code.",
		);
	}

	const { fullName } = JSON.parse(stored) as IRegistrationRedisPayload;
	const otpValue = crypto.randomInt(100000, 1000000);

	await redisClient.set(otpKey, otpValue.toString(), {
		expiration: { type: "EX", value: 5 * 60 },
	});
	await redisClient.set(dataKey, stored, {
		expiration: { type: "EX", value: 5 * 60 },
	});
	await redisClient.set(cooldownKey, "1", {
		expiration: { type: "EX", value: 60 },
	});

	const html = await ejs.renderFile(
		path.join(process.cwd(), "src/app/templates/registration-otp.ejs"),
		{ name: fullName, email, otpValue, expirationMinutes: 5 },
	);

	await transport.sendMail({
		from: config.smtp.sender,
		to: email,
		subject: "Verify Email Address",
		html,
	});

	return { message: "A new verification code has been sent." };
};

export const AuthService = {
	registerUser,
	googleLogin,
	loginUser,
	getMe,
	refreshToken,
	forgotPassword,
	resetPassword,
	verifyRegistrationEmail,
	updateProfileImage,
	updateMyProfile,
	changePassword,
	resendRegistrationOtp
};
