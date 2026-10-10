// import httpStatus from "http-status";
// import { type CreateEmailOptions, Resend } from "resend";
// import config from "../config";
// import { AppError } from "../errors/AppError";

// const resend = new Resend(config.resend.api_key);

// type TMailPayload = {
// 	to: string | string[];
// 	subject: string;
// 	html?: string;
// 	text?: string;
// 	replyTo?: string;
// 	attachments?: { filename: string; content: Buffer }[];
// };

// // Resend does NOT throw on failure, it returns { error }.
// // We throw so existing try/catch blocks keep working like they did with nodemailer.
// export const sendMail = async (mail: TMailPayload) => {
// 	const { data, error } = await resend.emails.send({
// 		from: config.resend.from,
// 		...mail,
// 	} as CreateEmailOptions);

// 	if (error) {
// 		throw new AppError(
// 			httpStatus.BAD_GATEWAY,
// 			`Email delivery failed: ${error.message}`,
// 		);
// 	}

// 	return data;
// };


import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../errors/AppError";

type TMailPayload = {
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
	replyTo?: string;
};

const EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";

const escapeHtml = (s: string) =>
	s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

const sendOne = async (to: string, mail: TMailPayload) => {
	const html =
		mail.html ??
		`<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(
			mail.text ?? "",
		)}</div>`;

	const res = await fetch(EMAILJS_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			service_id: config.emailjs.service_id,
			template_id: config.emailjs.template_id,
			user_id: config.emailjs.public_key,
			accessToken: config.emailjs.private_key,
			template_params: {
				to_email: to,
				subject: mail.subject,
				html,
				reply_to: mail.replyTo ?? "",
			},
		}),
	});

	if (!res.ok) {
		const reason = await res.text();
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`Email delivery failed: ${reason}`,
		);
	}
};

export const sendMail = async (mail: TMailPayload) => {
	const recipients = Array.isArray(mail.to) ? mail.to : [mail.to];
	await Promise.all(recipients.map((to) => sendOne(to, mail)));
	return { sent: recipients.length };
};