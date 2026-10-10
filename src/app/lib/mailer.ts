import httpStatus from "http-status";
import { type CreateEmailOptions, Resend } from "resend";
import config from "../config";
import { AppError } from "../errors/AppError";

const resend = new Resend(config.resend.api_key);

type TMailPayload = {
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
	replyTo?: string;
	attachments?: { filename: string; content: Buffer }[];
};

// Resend does NOT throw on failure, it returns { error }.
// We throw so existing try/catch blocks keep working like they did with nodemailer.
export const sendMail = async (mail: TMailPayload) => {
	const { data, error } = await resend.emails.send({
		from: config.resend.from,
		...mail,
	} as CreateEmailOptions);

	if (error) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`Email delivery failed: ${error.message}`,
		);
	}

	return data;
};
