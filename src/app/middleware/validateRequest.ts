import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type * as z from "zod";
import { AppError } from "../errors/AppError";
import { catchAsync } from "../utils/catchAsync";

export const validateRequestBody = (schema: z.ZodType) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const result = schema.safeParse(req.body);

		if (!result.success) {
			const errorMessages = result.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
			}));

			throw new AppError(httpStatus.BAD_REQUEST, "Validation failed", errorMessages);
		}

		req.body = result.data;
		next();
	});
};