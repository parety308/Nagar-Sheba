import { Role } from "../../../generated/prisma/browser";

// LOGIN USER PAYLOAD

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRegisterUserPayload {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
}

export interface IRegistrationRedisPayload {
    fullName: string;
    email: string;
    passwordHash: string;
    phone?: string;
    address?: string;
}

export interface IRegistrationVerifyPayload {
    email: string;
    otp: string;
}

// AUTHENTICATED REQUEST USER

export interface IRequestUser {
	userId: string;
	email: string;
	role: Role;
}

// GOOGLE lOGIN PAYLOAD

export interface IGoogleLoginPayload {
	idToken: string;
}

export interface IForgotPasswordPayload {
	email: string;
}

export interface IResetPasswordPayload {
	email: string;
	otp: string;
	newPassword: string;
}


