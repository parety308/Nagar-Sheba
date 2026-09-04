import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import {
	AccountStatus,
	AuthProvider,
	RequestStatus,
	Role,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { transport } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../auth/auth.interface";
import {
	IAuditLogQuery,
	IProvisionStaffPayload,
	IUpdateUserRolePayload,
	IUpdateUserStatusPayload,
	IUserListQuery,
} from "./admin.interface";

const generateTemporaryPassword = (): string => {
	const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
	const lower = "abcdefghijkmnopqrstuvwxyz";
	const digits = "23456789";
	const special = "@$!%*?&";
	const all = upper + lower + digits + special;

	const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];

	const passwordChars = [
		pick(upper),
		pick(lower),
		pick(digits),
		pick(special),
		...Array.from({ length: 8 }, () => pick(all)),
	];

	// Fisher-Yates shuffle so the guaranteed chars aren't always at the front
	for (let i = passwordChars.length - 1; i > 0; i--) {
		const j = crypto.randomInt(0, i + 1);
		[passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
	}

	return passwordChars.join("");
};

// PROVISION STAFF / ADMIN

const provisionStaff = async (payload: IProvisionStaffPayload) => {
	const organizationEmail = payload.organizationEmail.trim().toLowerCase();
	const personalEmail = payload.personalEmail.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({
		where: { email: organizationEmail },
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This organization email is already in use",
		);
	}

	if (payload.role === "STAFF") {
		const department = await prisma.department.findUnique({
			where: { id: payload.departmentId },
		});

		if (!department || department.deletedAt) {
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		}
	}

	const temporaryPassword = generateTemporaryPassword();
	const passwordHash = await bcrypt.hash(
		temporaryPassword,
		config.bcrypt_salt_rounds,
	);

	const createdUser = await prisma.user.create({
		data: {
			email: organizationEmail,
			passwordHash,
			role: payload.role as Role,
			status: AccountStatus.ACTIVE,
			authProvider: AuthProvider.CREDENTIAL,
			isEmailVerified: true, // provisioned accounts skip OTP — §5.2
			mustChangePassword: true, // forced on first login — §5.6
			...(payload.role === "STAFF"
				? {
						staffProfile: {
							create: {
								departmentId: payload.departmentId as string,
								fullName: payload.fullName,
								title: payload.title,
							},
						},
					}
				: {
						adminProfile: {
							create: { fullName: payload.fullName },
						},
					}),
		},
	});

	// Deliver credentials to the personal email. A delivery failure here
	// shouldn't undo the already-created account — log it so the account
	// can be manually communicated, but still return success to the Admin.
	try {
		const templatePath = path.join(
			process.cwd(),
			"src/app/templates/staff-welcome.ejs",
		);

		const html = await ejs.renderFile(templatePath, {
			fullName: payload.fullName,
			role: payload.role,
			organizationEmail,
			temporaryPassword,
		});

		await transport.sendMail({
			from: config.smtp.sender,
			to: personalEmail,
			subject: "Your Nagar Sheba Account",
			html,
		});
	} catch (error) {
		console.error("Failed to send staff welcome email:", error);
	}

	return {
		userId: createdUser.id,
		organizationEmail: createdUser.email,
	};
};

// BLOCK / UNBLOCK ACCOUNT

const updateUserStatus = async (
	targetUserId: string,
	payload: IUpdateUserStatusPayload,
	actor: IRequestUser,
) => {
	const targetUser = await prisma.user.findUnique({
		where: { id: targetUserId },
	});

	if (!targetUser || targetUser.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (targetUser.role === Role.ADMIN) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Admin accounts cannot be blocked or unblocked through the API",
		);
	}

	if (targetUser.id === actor.userId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"You cannot change the status of your own account",
		);
	}

	const [updated] = await prisma.$transaction([
		prisma.user.update({
			where: { id: targetUserId },
			data: { status: payload.status as AccountStatus },
		}),
		prisma.auditLog.create({
			data: {
				actorId: actor.userId,
				action:
					payload.status === "BLOCKED" ? "USER_BLOCKED" : "USER_UNBLOCKED",
				entityType: "User",
				entityId: targetUserId,
				previousValue: { status: targetUser.status },
				newValue: { status: payload.status },
			},
		}),
	]);

	const { passwordHash: _, ...safeUser } = updated;
	return safeUser;
};

// LIST / SEARCH USERS (paginated, filterable)

const ALLOWED_USER_SORT_FIELDS = ["createdAt", "email", "role", "status"];

const getAllUsers = async (query: IUserListQuery) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(
		Number(query.limit) > 0 ? Number(query.limit) : 10,
		100,
	);
	const skip = (page - 1) * limit;

	const sortBy = ALLOWED_USER_SORT_FIELDS.includes(query.sortBy as string)
		? (query.sortBy as string)
		: "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const where = {
		deletedAt: null,
		...(query.role ? { role: query.role as Role } : {}),
		...(query.status ? { status: query.status as AccountStatus } : {}),
		...(query.search
			? { email: { contains: query.search, mode: "insensitive" as const } }
			: {}),
	};

	const [items, total] = await Promise.all([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			select: {
				id: true,
				email: true,
				role: true,
				status: true,
				authProvider: true,
				isEmailVerified: true,
				mustChangePassword: true,
				createdAt: true,
				updatedAt: true,
				citizenProfile: { select: { fullName: true, phone: true } },
				staffProfile: {
					select: {
						fullName: true,
						title: true,
						department: { select: { id: true, name: true } },
					},
				},
				adminProfile: { select: { fullName: true } },
			},
		}),
		prisma.user.count({ where }),
	]);

	return {
		data: items,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
	};
};



const updateUserRole = async (
	targetUserId: string,
	payload: IUpdateUserRolePayload,
	actor: IRequestUser,
) => {
	if (targetUserId === actor.userId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"You cannot change your own role",
		);
	}

	const targetUser = await prisma.user.findUnique({
		where: { id: targetUserId },
		include: { staffProfile: true, adminProfile: true },
	});

	if (!targetUser || targetUser.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (targetUser.role === Role.CITIZEN) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Citizen accounts cannot be promoted through this endpoint",
		);
	}

	if (payload.role === "CITIZEN" as any) {
		// unreachable given zod enum, kept as a defensive guard
		throw new AppError(httpStatus.BAD_REQUEST, "Cannot demote a user to CITIZEN");
	}

	if (targetUser.role === payload.role) {
		throw new AppError(
			httpStatus.CONFLICT,
			`User already has the ${payload.role} role`,
		);
	}

	let resolvedDepartmentId: string | undefined;

	if (payload.role === "STAFF") {
		const department = await prisma.department.findUnique({
			where: { id: payload.departmentId },
		});

		if (!department || department.deletedAt) {
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		}

		resolvedDepartmentId = department.id;
	}

	const previousRole = targetUser.role;
	const fullName =
		targetUser.staffProfile?.fullName ??
		targetUser.adminProfile?.fullName ??
		"User";

	const updated = await prisma.$transaction(async (tx) => {
		// Drop the profile tied to the OLD role.
		if (previousRole === Role.STAFF && targetUser.staffProfile) {
			// Any request still assigned to this staff member is unassigned
			// first, since StaffProfile deletion doesn't cascade that.
			await tx.serviceRequest.updateMany({
				where: { assignedStaffId: targetUserId },
				data: { assignedStaffId: null },
			});
			await tx.staffProfile.delete({ where: { userId: targetUserId } });
		} else if (previousRole === Role.ADMIN && targetUser.adminProfile) {
			await tx.adminProfile.delete({ where: { userId: targetUserId } });
		}

		// Create the profile for the NEW role and flip User.role.
		const user = await tx.user.update({
			where: { id: targetUserId },
			data: {
				role: payload.role as Role,
				...(payload.role === "STAFF"
					? {
							staffProfile: {
								create: {
									departmentId: resolvedDepartmentId as string,
									fullName: payload.title ? fullName : fullName,
									title: payload.title,
								},
							},
						}
					: {
							adminProfile: {
								create: { fullName },
							},
						}),
			},
		});

		await tx.auditLog.create({
			data: {
				actorId: actor.userId,
				action: "USER_ROLE_CHANGED",
				entityType: "User",
				entityId: targetUserId,
				previousValue: { role: previousRole },
				newValue: { role: payload.role, departmentId: resolvedDepartmentId },
			},
		});

		return user;
	});

	const { passwordHash: _, ...safeUser } = updated;
	return safeUser;
};


const getAuditLogs = async (query: IAuditLogQuery) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(
		Number(query.limit) > 0 ? Number(query.limit) : 20,
		100,
	);
	const skip = (page - 1) * limit;

	const where = {
		...(query.entityType ? { entityType: query.entityType } : {}),
		...(query.actorId ? { actorId: query.actorId } : {}),
	};

	const [items, total] = await Promise.all([
		prisma.auditLog.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: { actor: { select: { id: true, email: true, role: true } } },
		}),
		prisma.auditLog.count({ where }),
	]);

	return {
		data: items,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
	};
};

// DASHBOARD STATS

const getDashboardStats = async () => {
	const [
		totalUsers,
		totalCitizens,
		totalStaff,
		totalRequests,
		requestsByStatus,
		overdueCount,
		totalRevenue,
		pendingPayments,
		avgRating,
	] = await Promise.all([
		prisma.user.count({ where: { deletedAt: null } }),
		prisma.user.count({ where: { role: Role.CITIZEN, deletedAt: null } }),
		prisma.user.count({ where: { role: Role.STAFF, deletedAt: null } }),
		prisma.serviceRequest.count({ where: { deletedAt: null } }),
		prisma.serviceRequest.groupBy({
			by: ["status"],
			_count: { _all: true },
			where: { deletedAt: null },
		}),
		prisma.serviceRequest.count({
			where: { isOverdue: true, deletedAt: null },
		}),
		prisma.payment.aggregate({
			_sum: { amount: true },
			where: { status: "COMPLETED" },
		}),
		prisma.payment.count({ where: { status: "PENDING" } }),
		prisma.feedback.aggregate({ _avg: { rating: true } }),
	]);

	return {
		users: { total: totalUsers, citizens: totalCitizens, staff: totalStaff },
		requests: {
			total: totalRequests,
			overdue: overdueCount,
			byStatus: requestsByStatus.reduce(
				(acc, row) => {
					acc[row.status as RequestStatus] = row._count._all;
					return acc;
				},
				{} as Record<string, number>,
			),
		},
		payments: {
			totalRevenue: totalRevenue._sum.amount ?? 0,
			pending: pendingPayments,
		},
		feedback: {
			averageRating: avgRating._avg.rating ?? null,
		},
	};
};


export const AdminService = {
	provisionStaff,
	updateUserStatus,
	getAllUsers,
	updateUserRole,
	getAuditLogs,
	getDashboardStats,
};
