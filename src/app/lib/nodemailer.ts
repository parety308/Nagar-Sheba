import nodemailer from "nodemailer";
import config from "../config";

export const transport = nodemailer.createTransport({
	host: "smtp.gmail.com",
	port: 465,
	secure: true, 
	auth: {
		user: config.smtp.user,
		pass: config.smtp.password,
	},
});