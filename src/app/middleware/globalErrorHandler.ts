import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import multer from "multer";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../errors/AppError";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const globalErrorHandler = async (
	err: any,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	if (config.node_env === "development") {
		console.log("Error from Global Error Handler:", err);
	}

	let statusCode: Number = httpStatus.INTERNAL_SERVER_ERROR;
	let errorMessage = "Internal Server Error";
	let errorName = "Internal Server Error";
	let errorMessages: { path: string; message: string }[] = [];

	// App Error
	if (err instanceof AppError) {
		statusCode = err.statusCode;
		errorMessage = err.message;
		errorName = "AppError";
		errorMessages = err.errorMessages || [];
	}

	// Multer Error
	else if (err instanceof multer.MulterError) {
		statusCode = httpStatus.BAD_REQUEST;
		errorMessage = err.message;
		errorName = "MulterError";
	}

	// Prisma Validation Error
	else if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = httpStatus.BAD_REQUEST;
		errorMessage = "You have provided incorrect field type or missing fields";
		errorName = "PrismaClientValidationError";
	}

	// Prisma Known Request Error
	else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		errorName = "PrismaClientKnownRequestError";

		if (err.code === "P2002") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage = "Duplicate Key Error";
		} else if (err.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage = "Foreign key constraint failed";
		} else if (err.code === "P2025") {
			statusCode = httpStatus.NOT_FOUND;
			errorMessage =
				"An operation failed because the required record was not found.";
		}
	}

	// Prisma Initialization Error
	else if (err instanceof Prisma.PrismaClientInitializationError) {
		errorName = "PrismaClientInitializationError";

		if (err.errorCode === "P1000") {
			statusCode = httpStatus.UNAUTHORIZED;
			errorMessage =
				"Authentication failed against database server. Please check your credentials.";
		} else if (err.errorCode === "P1001") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage = "Can't reach database server.";
		}
	}

	// Prisma Unknown Request Error
	else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
		errorMessage = "Error occurred during query execution.";
		errorName = "PrismaClientUnknownRequestError";
	}

	// Generic Error
	else if (err instanceof Error) {
		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
		errorMessage = err.message;
		errorName = err.name;
	}

	res.status(statusCode as number).json({
		success: false,
		statusCode,
		name:
			config.node_env === "development" ? errorName : "Internal Server Error",
		message:
			config.node_env === "development"
				? errorMessage
				: "Internal Server Error",
		errors: errorMessages,
		error: config.node_env === "development" ? err : undefined,
		stack: config.node_env === "development" ? err.stack : undefined,
	});
};
