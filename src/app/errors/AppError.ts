export class AppError extends Error {
	statusCode: number;
	errorMessages: { path: string; message: string }[];

	constructor(
		statusCode: number,
		message: string,
		errorMessages: { path: string; message: string }[] = [],
		stack?: string,
	) {
		super(message);
		this.statusCode = statusCode;
		this.errorMessages = errorMessages;
		Object.setPrototypeOf(this, AppError.prototype);
		if (stack) this.stack = stack;
		else Error.captureStackTrace(this, this.constructor);
	}
}
