import * as z from "zod";

// COMMON PASSWORD SCHEMA

const passwordSchema = z
	.string("Password is required")
	.min(6, "Password must be at least 6 characters long")
	.refine(
		(password) => /[A-Z]/.test(password),
		"Password must contain at least one uppercase letter",
	)
	.refine(
		(password) => /[a-z]/.test(password),
		"Password must contain at least one lowercase letter",
	)
	.refine(
		(password) => /\d/.test(password),
		"Password must contain at least one digit",
	)
	.refine(
		(password) => /[@$!%*?&]/.test(password),
		"Password must contain at least one special character (@, $, !, %, *, ?, &)",
	);

// REGISTER USER

const RegisterUserZodSchema = z.object({
	fullName: z
		.string("Full name is required")
		.min(2, "Full name must be at least 2 characters long")
		.max(100, "Full name must not exceed 100 characters"),

	email: z.email("Please provide a valid email address."),

	password: passwordSchema,

	phone: z
		.string("Phone number must be a string")
		.min(10, "Phone number must be at least 10 characters long")
		.max(20, "Phone number must not exceed 20 characters")
		.optional(),

	address: z
		.string("Address must be a string")
		.max(255, "Address must not exceed 255 characters")
		.optional(),
});

// LOGIN USER

const LoginUserZodSchema = z.object({
	email: z.email("Please provide a valid email address."),

	password: z.string("Password is required").min(1, "Password is required"),
});

// GOOGLE LOGIN

const GoogleLoginZodSchema = z.object({
	idToken: z
		.string("Google ID token is required")
		.min(1, "Google ID token is required"),
});

// VERIFY EMAIL OTP

const VerifyEmailZodSchema = z.object({
	email: z.email("Please provide a valid email address."),

	otp: z
		.string("OTP is required")
		.length(6, "OTP must be exactly 6 digits long")
		.regex(/^\d{6}$/, "OTP must contain only digits"),
});

// FORGOT PASSWORD

const ForgotPasswordZodSchema = z.object({
	email: z.email("Please provide a valid email address."),
});


// REFRESH TOKEN

const RefreshTokenZodSchema = z.object({
	refreshToken: z
		.string("Refresh token is required")
		.min(1, "Refresh token is required")
		.optional(),
});
// RESET PASSWORD

const ResetPasswordZodSchema = z.object({
	email: z.email("Please provide a valid email address."),

	otp: z
		.string("OTP is required")
		.length(6, "OTP must be exactly 6 digits long")
		.regex(/^\d{6}$/, "OTP must contain only digits"),

	newPassword: passwordSchema,
});

const CitizenEmailVerifyZodSchema = z.object({
	email: z.email("Invalid email address"),
	otp: z
		.string("OTP is required.")
		.length(6, "OTP must be exactly 6 digits long."),
});

const ProfileImageZodSchema = z.object({
	mimetype: z
		.string()
		.refine(
			(val) =>
				["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(val),
			"Only JPEG, PNG or WEBP images are allowed",
		),
	size: z.number().max(5 * 1024 * 1024, "Image must be smaller than 5MB"),
});

const UpdateProfileZodSchema = z
	.object({
		fullName: z
			.string("Full name must be a string")
			.min(2, "Full name must be at least 2 characters long")
			.max(100, "Full name must not exceed 100 characters")
			.optional(),

		phone: z
			.string("Phone number must be a string")
			.min(10, "Phone number must be at least 10 characters long")
			.max(20, "Phone number must not exceed 20 characters")
			.optional(),

		address: z
			.string("Address must be a string")
			.max(255, "Address must not exceed 255 characters")
			.optional(),

		title: z
			.string("Title must be a string")
			.max(100, "Title must not exceed 100 characters")
			.optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided to update.",
	});

export const authValidationSchemas = {
	RegisterUserZodSchema,
	LoginUserZodSchema,
	GoogleLoginZodSchema,
	VerifyEmailZodSchema,
	ForgotPasswordZodSchema,
	ResetPasswordZodSchema,
	RefreshTokenZodSchema,
	CitizenEmailVerifyZodSchema,
	ProfileImageZodSchema,
	UpdateProfileZodSchema,
};
