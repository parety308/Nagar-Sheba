import config from "../../config";
import { transport } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";

const getStats = async () => {
	const [totalRequests, resolvedRequests, departments, categories, rating] =
		await Promise.all([
			prisma.serviceRequest.count({ where: { deletedAt: null } }),
			prisma.serviceRequest.count({
				where: { deletedAt: null, status: { in: ["RESOLVED", "CLOSED"] } },
			}),
			prisma.department.count({ where: { deletedAt: null } }),
			prisma.category.count({ where: { deletedAt: null, isActive: true } }),
			prisma.feedback.aggregate({ _avg: { rating: true } }),
		]);

	return {
		totalRequests,
		resolvedRequests,
		departments,
		categories,
		averageRating: rating._avg.rating ?? null,
	};
};

const sendContactMessage = async (payload: {
	name: string;
	email: string;
	subject: string;
	message: string;
}) => {
	await transport.sendMail({
		from: config.smtp.sender,
		to: config.smtp.user,
		replyTo: payload.email,
		subject: `[Nagar Sheba Contact] ${payload.subject}`,
		text: `From: ${payload.name} <${payload.email}>\n\n${payload.message}`,
	});
	return null;
};

export const PublicService = { getStats, sendContactMessage };
