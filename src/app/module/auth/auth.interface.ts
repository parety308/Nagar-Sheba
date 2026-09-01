import { Gender, Role } from "../../../generated/prisma/browser";

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRegisterUserPayload {
	name: string;
	email: string;
	password: string;
	phone?: string;
	profileImage?: string;
	address?: string;
	gender?: Gender;
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}