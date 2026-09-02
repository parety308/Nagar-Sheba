import nodemailer from "nodemailer";
import config from "../config";

export const transport = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: config.smtp.user,
		pass: config.smtp.password,
	},
});
