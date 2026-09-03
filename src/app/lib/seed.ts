import bcrypt from "bcryptjs";
import { AccountStatus, Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "./prisma";

const SALT_ROUNDS = config.bcrypt_salt_rounds;

const ADMIN_EMAIL = config.admin.email;
const ADMIN_PASSWORD = config.admin.password;
const STAFF_PASSWORD = config.staff_password;

// Departments

const DEPARTMENTS = [
	{
		name: "Roads & Infrastructure",
		description: "Potholes, road damage, streetlights, footpaths",
	},
	{
		name: "Waste Management",
		description: "Garbage collection, illegal dumping, bin repairs",
	},
	{
		name: "Water Supply",
		description: "Water leakage, supply interruptions, drainage",
	},
	{
		name: "Licensing & Permits",
		description: "Trade licences, noise permits, tree-cutting permits",
	},
] as const;

// Categories

type CategorySeed = {
	department: (typeof DEPARTMENTS)[number]["name"];
	name: string;
	feeType: "FREE" | "PAID";
	feeAmount?: number;
	slaHours: number;
};

const CATEGORIES: CategorySeed[] = [
	{
		department: "Roads & Infrastructure",
		name: "Pothole",
		feeType: "FREE",
		slaHours: 72,
	},
	{
		department: "Roads & Infrastructure",
		name: "Streetlight Outage",
		feeType: "FREE",
		slaHours: 48,
	},
	{
		department: "Waste Management",
		name: "Missed Garbage Collection",
		feeType: "FREE",
		slaHours: 24,
	},
	{
		department: "Water Supply",
		name: "Water Leakage",
		feeType: "FREE",
		slaHours: 24,
	},
	{
		department: "Licensing & Permits",
		name: "Trade Licence Renewal",
		feeType: "PAID",
		feeAmount: 1500,
		slaHours: 168,
	},
	{
		department: "Licensing & Permits",
		name: "Noise Permit",
		feeType: "PAID",
		feeAmount: 800,
		slaHours: 120,
	},
	{
		department: "Licensing & Permits",
		name: "Tree Cutting Permit",
		feeType: "PAID",
		feeAmount: 500,
		slaHours: 96,
	},
];

// Staff

const STAFF = [
	{
		email: "staff.roads@nagar-sheba.com",
		fullName: "Rahim Uddin",
		title: "Field Technician",
		department: "Roads & Infrastructure",
	},
	{
		email: "staff.waste@nagar-sheba.com",
		fullName: "Karim Ahmed",
		title: "Sanitation Officer",
		department: "Waste Management",
	},
	{
		email: "staff.water@nagar-sheba.com",
		fullName: "Nusrat Jahan",
		title: "Water Supply Inspector",
		department: "Water Supply",
	},
	{
		email: "staff.licensing@nagar-sheba.com",
		fullName: "Farhana Islam",
		title: "Licensing Officer",
		department: "Licensing & Permits",
	},
] as const;

// Seed

export const seed = async (): Promise<void> => {
	console.log(" Starting Nagar-Sheba database seed...");

	await prisma.$transaction(async (tx) => {
		// 1. Departments

		const departmentIdByName = new Map<string, string>();

		for (const department of DEPARTMENTS) {
			const record = await tx.department.upsert({
				where: {
					name: department.name,
				},
				update: {
					description: department.description,
				},
				create: {
					name: department.name,
					description: department.description,
				},
			});

			departmentIdByName.set(department.name, record.id);
		}

		// 2. Categories

		for (const category of CATEGORIES) {
			const departmentId = departmentIdByName.get(category.department);

			if (!departmentId) {
				throw new Error(`Department not found: ${category.department}`);
			}

			await tx.category.upsert({
				where: {
					departmentId_name: {
						departmentId,
						name: category.name,
					},
				},
				update: {
					feeType: category.feeType,
					feeAmount: category.feeType === "PAID" ? category.feeAmount : null,
					slaHours: category.slaHours,
				},
				create: {
					departmentId,
					name: category.name,
					feeType: category.feeType,
					feeAmount: category.feeType === "PAID" ? category.feeAmount : null,
					slaHours: category.slaHours,
				},
			});
		}

		// 3. Admin

		const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

		await tx.user.upsert({
			where: { email: ADMIN_EMAIL },
			update: {
				passwordHash: adminPasswordHash,
				role: Role.ADMIN,
				status: AccountStatus.ACTIVE,
				isEmailVerified: true,
				mustChangePassword: false,
			},
			create: {
				email: ADMIN_EMAIL,
				passwordHash: adminPasswordHash,
				role: Role.ADMIN,
				status: AccountStatus.ACTIVE,
				isEmailVerified: true,
				mustChangePassword: false,
				adminProfile: {
					create: { fullName: "Nagar-Sheba Platform Admin" },
				},
			},
		});

		// 4. Staff

		const staffPasswordHash = await bcrypt.hash(STAFF_PASSWORD, SALT_ROUNDS);

		for (const staff of STAFF) {
			const departmentId = departmentIdByName.get(staff.department);

			if (!departmentId) {
				throw new Error(`Department not found: ${staff.department}`);
			}

			await tx.user.upsert({
				where: {
					email: staff.email,
				},
				update: {
					passwordHash: staffPasswordHash,
					role: Role.STAFF,
					status: AccountStatus.ACTIVE,
					isEmailVerified: true,
					mustChangePassword: false,
				},
				create: {
					email: staff.email,
					passwordHash: staffPasswordHash,
					role: Role.STAFF,
					status: AccountStatus.ACTIVE,
					isEmailVerified: true,
					mustChangePassword: false,
					staffProfile: {
						create: {
							departmentId,
							fullName: staff.fullName,
							title: staff.title,
						},
					},
				},
			});
		}
	});

	console.log(
		` Nagar-Sheba seed completed successfully. ` +
			`${DEPARTMENTS.length} departments, ` +
			`${CATEGORIES.length} categories, ` +
			`1 admin, ${STAFF.length} staff.`,
	);
};
