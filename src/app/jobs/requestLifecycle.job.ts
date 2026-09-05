import { RequestStatus } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";

const NON_TERMINAL_STATUSES: RequestStatus[] = [
	RequestStatus.PENDING_PAYMENT,
	RequestStatus.SUBMITTED,
	RequestStatus.ASSIGNED,
	RequestStatus.IN_PROGRESS,
];

const REOPEN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const flagOverdueRequests = async () => {
	const now = new Date();

	const result = await prisma.serviceRequest.updateMany({
		where: {
			status: { in: NON_TERMINAL_STATUSES },
			isOverdue: false,
			slaDueAt: { not: null, lt: now },
			deletedAt: null,
		},
		data: { isOverdue: true },
	});

	if (result.count > 0) {
		console.log(
			`[requestLifecycleJob] Flagged ${result.count} request(s) as overdue.`,
		);
	}
};

const autoCloseExpiredResolutions = async () => {
	const cutoff = new Date(Date.now() - REOPEN_WINDOW_MS);

	const candidates = await prisma.serviceRequest.findMany({
		where: {
			status: RequestStatus.RESOLVED,
			resolvedAt: { not: null, lt: cutoff },
			deletedAt: null,
		},
		select: { id: true, citizenId: true, status: true },
	});

	for (const request of candidates) {
		await prisma.$transaction([
			prisma.statusHistory.create({
				data: {
					requestId: request.id,
					fromStatus: request.status,
					toStatus: RequestStatus.CLOSED,

					changedBy: request.citizenId,
					note: "Auto-closed: 3-day citizen response window elapsed",
				},
			}),
			prisma.serviceRequest.update({
				where: { id: request.id },
				data: { status: RequestStatus.CLOSED, closedAt: new Date() },
			}),
		]);
	}

	if (candidates.length > 0) {
		console.log(
			`[requestLifecycleJob] Auto-closed ${candidates.length} request(s).`,
		);
	}
};

export const runRequestLifecycleJob = async () => {
	try {
		await flagOverdueRequests();
		await autoCloseExpiredResolutions();
	} catch (error) {
		console.error("[requestLifecycleJob] failed:", error);
	}
};
