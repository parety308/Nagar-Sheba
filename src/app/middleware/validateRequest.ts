
import type { NextFunction, Request, Response } from "express";
import type * as z from "zod";
import { catchAsync } from "../utils/catchAsync";

export const validateRequestBody = (schema: z.ZodType) => {
	return catchAsync(
		async (req: Request, res: Response, next: NextFunction) => {
			const result = schema.safeParse(req.body);

			if (!result.success) {
				throw new Error(
					result.error.issues
						.map((issue) => issue.message)
						.join(", "),
				);
			}

			req.body = result.data;

			next();
		},
	);
};
