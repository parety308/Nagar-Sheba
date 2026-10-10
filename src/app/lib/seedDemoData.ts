import type { Prisma } from "../../generated/prisma/client";
import type { RequestStatus } from "../../generated/prisma/enums";
import {
	PaymentProvider,
	PaymentStatus,
	Role,
} from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "./prisma";

type Spec = {
	category: string;
	title: string;
	description: string;
	address: string;
	latitude: number;
	longitude: number;
	status: RequestStatus;
	ageHours: number;
	payment?: "COMPLETED" | "REFUNDED";
	rating?: number;
	comment?: string;
};

const SPECS: Spec[] = [
	{
		category: "Pothole",
		title: "Deep pothole near Agrabad bus stop",
		description:
			"A large pothole has formed on the main road and is damaging vehicles every day.",
		address: "Agrabad Access Road, Chattogram",
		latitude: 22.3247,
		longitude: 91.8123,
		status: "SUBMITTED",
		ageHours: 6,
	},
	{
		category: "Pothole",
		title: "Road crater outside GEC Circle",
		description:
			"Rainwater collected in a crater at the roundabout, making it dangerous at night.",
		address: "GEC Circle, Chattogram",
		latitude: 22.3589,
		longitude: 91.8213,
		status: "ASSIGNED",
		ageHours: 30,
	},
	{
		category: "Pothole",
		title: "Broken road surface on CDA Avenue",
		description:
			"The surface has been broken for two weeks and the damage keeps widening.",
		address: "CDA Avenue, Chattogram",
		latitude: 22.3631,
		longitude: 91.8341,
		status: "IN_PROGRESS",
		ageHours: 120,
	},
	{
		category: "Streetlight Outage",
		title: "Streetlights out on Station Road",
		description:
			"Four consecutive streetlights have not worked for a week, leaving the road dark.",
		address: "Station Road, Chattogram",
		latitude: 22.3301,
		longitude: 91.8392,
		status: "IN_PROGRESS",
		ageHours: 40,
	},
	{
		category: "Streetlight Outage",
		title: "Flickering lamp at Muradpur crossing",
		description:
			"The lamp flickers all night and goes out completely after midnight.",
		address: "Muradpur, Chattogram",
		latitude: 22.3698,
		longitude: 91.8301,
		status: "RESOLVED",
		ageHours: 30,
		rating: 3,
		comment: "Fixed, but it took longer than promised.",
	},
	{
		category: "Missed Garbage Collection",
		title: "Garbage not collected for three days",
		description:
			"The bins on our street have overflowed and the smell is spreading to nearby homes.",
		address: "Panchlaish, Chattogram",
		latitude: 22.3615,
		longitude: 91.8049,
		status: "RESOLVED",
		ageHours: 20,
		rating: 5,
		comment: "Collected the same afternoon. Thank you!",
	},
	{
		category: "Missed Garbage Collection",
		title: "Waste pile blocking the footpath",
		description:
			"Waste dumped beside the market is blocking the footpath and attracting stray animals.",
		address: "Chawkbazar, Chattogram",
		latitude: 22.3569,
		longitude: 91.8359,
		status: "CANCELLED",
		ageHours: 90,
	},
	{
		category: "Water Leakage",
		title: "Burst pipe flooding the lane",
		description:
			"A main water pipe has burst and water is running down the lane continuously.",
		address: "Khulshi, Chattogram",
		latitude: 22.3527,
		longitude: 91.7968,
		status: "ASSIGNED",
		ageHours: 60,
	},
	{
		category: "Water Leakage",
		title: "Slow leak under the road at Nasirabad",
		description:
			"A slow leak has kept the road wet for days and is starting to damage the asphalt.",
		address: "Nasirabad, Chattogram",
		latitude: 22.3721,
		longitude: 91.8203,
		status: "CLOSED",
		ageHours: 200,
		rating: 4,
		comment: "Fixed properly and the road was repaired.",
	},
	{
		category: "Pothole",
		title: "Potholes along Oxygen Road",
		description:
			"Several potholes along a 200 metre stretch are slowing traffic and causing accidents.",
		address: "Oxygen Road, Chattogram",
		latitude: 22.3745,
		longitude: 91.8097,
		status: "CLOSED",
		ageHours: 300,
		rating: 2,
		comment: "Patched, but the patch is already breaking up.",
	},
	{
		category: "Trade Licence Renewal",
		title: "Annual trade licence renewal for my shop",
		description:
			"Renewing the annual trade licence for my grocery shop at the Agrabad commercial area.",
		address: "Agrabad Commercial Area, Chattogram",
		latitude: 22.3256,
		longitude: 91.8098,
		status: "PENDING_PAYMENT",
		ageHours: 3,
	},
	{
		category: "Noise Permit",
		title: "Noise permit for a wedding ceremony",
		description:
			"Requesting a temporary noise permit for a wedding ceremony using sound equipment.",
		address: "Nasirabad Housing Society, Chattogram",
		latitude: 22.3708,
		longitude: 91.8187,
		status: "IN_PROGRESS",
		ageHours: 50,
		payment: "COMPLETED",
	},
	{
		category: "Tree Cutting Permit",
		title: "Permit to remove a dangerous tree",
		description:
			"A damaged tree is leaning over the house and needs to be removed safely.",
		address: "Pahartali, Chattogram",
		latitude: 22.3856,
		longitude: 91.7944,
		status: "SUBMITTED",
		ageHours: 10,
		payment: "COMPLETED",
	},
	{
		category: "Trade Licence Renewal",
		title: "Trade licence renewal for a pharmacy",
		description:
			"Renewing the trade licence for a pharmacy on the main road, all documents attached.",
		address: "Bahaddarhat, Chattogram",
		latitude: 22.3812,
		longitude: 91.8321,
		status: "CLOSED",
		ageHours: 400,
		payment: "COMPLETED",
		rating: 5,
		comment: "Smooth process, licence delivered on time.",
	},
	{
		category: "Noise Permit",
		title: "Noise permit for a community event",
		description:
			"Requested a permit for a community event but the plan changed so I cancelled.",
		address: "Halishahar, Chattogram",
		latitude: 22.3354,
		longitude: 91.7762,
		status: "CANCELLED",
		ageHours: 150,
		payment: "REFUNDED",
	},
];

const PATH: RequestStatus[] = [
	"SUBMITTED",
	"ASSIGNED",
	"IN_PROGRESS",
	"RESOLVED",
	"CLOSED",
];
const NOTES: Partial<Record<RequestStatus, string>> = {
	ASSIGNED: "Assigned by administrator",
	IN_PROGRESS: "Crew started work",
	RESOLVED: "Issue fixed and verified on site",
	CLOSED: "Auto-closed: 3-day citizen response window elapsed",
};

const at = (base: Date, hours: number) =>
	new Date(base.getTime() + hours * 3_600_000);

export const seedDemoData = async (): Promise<void> => {
	if (process.env.SEED_DEMO_DATA === "false") return;

	const [citizen, admin] = await Promise.all([
		prisma.user.findUnique({ where: { email: config.demo_citizen.email } }),
		prisma.user.findUnique({ where: { email: config.admin.email } }),
	]);
	if (!citizen || !admin) return;

	const year = new Date().getFullYear();
	const now = new Date();
	let created = 0;

	for (const [index, s] of SPECS.entries()) {
		const trackingRef = `NS-${year}-${900001 + index}`;
		const exists = await prisma.serviceRequest.findUnique({
			where: { trackingRef },
			select: { id: true },
		});
		if (exists) continue;

		const category = await prisma.category.findFirst({
			where: { name: s.category, deletedAt: null },
		});
		if (!category) continue;

		const staff = await prisma.user.findFirst({
			where: {
				role: Role.STAFF,
				staffProfile: { departmentId: category.departmentId },
			},
		});

		const isPaid = category.feeType === "PAID";
		const hasPayment = isPaid && !!s.payment;
		const createdAt = at(now, -s.ageHours);
		const gap = s.ageHours * 0.12;

		const history: {
			fromStatus: RequestStatus;
			toStatus: RequestStatus;
			changedBy: string;
			note: string;
			createdAt: Date;
		}[] = [];
		let time = createdAt;
		const step = (
			from: RequestStatus,
			to: RequestStatus,
			by: string,
			note: string,
		) => {
			time = at(time, gap);
			history.push({
				fromStatus: from,
				toStatus: to,
				changedBy: by,
				note,
				createdAt: time,
			});
			return time;
		};

		let assignedAt: Date | null = null;
		let resolvedAt: Date | null = null;
		let closedAt: Date | null = null;
		let cancelledAt: Date | null = null;

		if (hasPayment && s.status !== "PENDING_PAYMENT") {
			step(
				"PENDING_PAYMENT",
				"SUBMITTED",
				citizen.id,
				"Payment verified via SSLCOMMERZ",
			);
		}

		if (s.status === "CANCELLED") {
			cancelledAt = step(
				"SUBMITTED",
				"CANCELLED",
				citizen.id,
				"Cancelled by citizen",
			);
		} else {
			const target = PATH.indexOf(s.status);
			for (let i = 1; i <= target; i++) {
				const to = PATH[i];
				const by =
					to === "ASSIGNED"
						? admin.id
						: to === "CLOSED"
							? citizen.id
							: (staff?.id ?? admin.id);
				const when = step(PATH[i - 1], to, by, NOTES[to] ?? "");
				if (to === "ASSIGNED") assignedAt = when;
				if (to === "RESOLVED") resolvedAt = when;
				if (to === "CLOSED") closedAt = when;
			}
		}

		const slaDueAt = assignedAt ? at(assignedAt, category.slaHours) : null;
		const open = s.status === "ASSIGNED" || s.status === "IN_PROGRESS";
		const isOverdue =
			(open && !!slaDueAt && slaDueAt < now) ||
			(!!resolvedAt && !!slaDueAt && resolvedAt > slaDueAt);

		const request = await prisma.serviceRequest.create({
			data: {
				trackingRef,
				citizenId: citizen.id,
				categoryId: category.id,
				departmentId: category.departmentId,
				assignedStaffId: assignedAt && staff ? staff.id : null,
				title: s.title,
				description: s.description,
				address: s.address,
				latitude: s.latitude,
				longitude: s.longitude,
				status: s.status,
				feeCharged: isPaid ? category.feeAmount : null,
				slaDueAt,
				isOverdue,
				resolvedAt,
				closedAt,
				cancelledAt,
				createdAt,
			} satisfies Prisma.ServiceRequestUncheckedCreateInput,
		});

		if (history.length > 0) {
			await prisma.statusHistory.createMany({
				data: history.map((h) => ({ ...h, requestId: request.id })),
			});
		}

		if (hasPayment && s.payment && category.feeAmount) {
			await prisma.payment.create({
				data: {
					requestId: request.id,
					provider: PaymentProvider.SSLCOMMERZ,
					providerRef: `SEED-${trackingRef}`,
					amount: category.feeAmount,
					status:
						s.payment === "REFUNDED"
							? PaymentStatus.REFUNDED
							: PaymentStatus.COMPLETED,
					paidAt: at(createdAt, gap),
					refundedAt: s.payment === "REFUNDED" ? (cancelledAt ?? now) : null,
					createdAt,
				},
			});
		}

		if (s.rating) {
			await prisma.feedback.create({
				data: {
					requestId: request.id,
					citizenId: citizen.id,
					rating: s.rating,
					comment: s.comment,
				},
			});
		}

		created++;
	}

	console.log(`Demo data: ${created} sample request(s) created.`);
};
