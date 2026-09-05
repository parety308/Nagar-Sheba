import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../auth/auth.interface";
import {
	ICategoryQuery,
	ICreateCategoryPayload,
	IUpdateCategoryPayload,
} from "./category.interface";

// create category
const createCategory = async (
	payload: ICreateCategoryPayload,
	actor: IRequestUser,
) => {
	const department = await prisma.department.findUnique({
		where: { id: payload.departmentId },
	});

	if (!department || department.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	const existing = await prisma.category.findUnique({
		where: {
			departmentId_name: {
				departmentId: payload.departmentId,
				name: payload.name,
			},
		},
	});

	if (existing) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"A category with this name already exists in this department",
		);
	}

	const [category] = await prisma.$transaction([
		prisma.category.create({
			data: {
				departmentId: payload.departmentId,
				name: payload.name,
				feeType: payload.feeType,
				feeAmount: payload.feeType === "PAID" ? payload.feeAmount : null,
				slaHours: payload.slaHours,
			},
		}),
	]);

	await prisma.auditLog.create({
		data: {
			actorId: actor.userId,
			action: "CATEGORY_CREATED",
			entityType: "Category",
			entityId: category.id,
			previousValue: undefined,
			newValue: {
				name: category.name,
				departmentId: category.departmentId,
				feeType: category.feeType,
				feeAmount: category.feeAmount,
				slaHours: category.slaHours,
			},
		},
	});

	return category;
};

// GET ALL CATEGORIES (paginated, filterable by department)

const getAllCategories = async (
	query: ICategoryQuery,
	requesterRole?: Role,
) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
	const skip = (page - 1) * limit;

	const includeInactive =
		requesterRole === Role.ADMIN && !!query.includeInactive;

	const where = {
		...(includeInactive ? {} : { deletedAt: null, isActive: true }),
		...(query.departmentId ? { departmentId: query.departmentId } : {}),
	};

	const [categories, total] = await Promise.all([
		prisma.category.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: { department: { select: { id: true, name: true } } },
		}),
		prisma.category.count({ where }),
	]);

	return {
		data: categories,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit) || 1,
		},
	};
};

// GET SINGLE CATEGORY

const getSingleCategory = async (id: string) => {
	const category = await prisma.category.findUnique({
		where: { id },
		include: { department: { select: { id: true, name: true } } },
	});

	if (!category || category.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Category not found");
	}

	return category;
};

// UPDATE CATEGORY

const updateCategory = async (
	id: string,
	payload: IUpdateCategoryPayload,
	actor: IRequestUser,
) => {
	const category = await prisma.category.findUnique({ where: { id } });

	if (!category || category.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Category not found");
	}


	const nextFeeType = payload.feeType ?? category.feeType;
	const nextFeeAmount =
		nextFeeType === "FREE" ? null : (payload.feeAmount ?? category.feeAmount);

	if (
		nextFeeType === "PAID" &&
		(!nextFeeAmount || Number(nextFeeAmount) <= 0)
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"feeAmount is required and must be greater than 0 for a PAID category",
		);
	}

	if (payload.name && payload.name !== category.name) {
		const nameTaken = await prisma.category.findUnique({
			where: {
				departmentId_name: {
					departmentId: category.departmentId,
					name: payload.name,
				},
			},
		});

		if (nameTaken) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"A category with this name already exists in this department",
			);
		}
	}

	const previousValue = {
		name: category.name,
		feeType: category.feeType,
		feeAmount: category.feeAmount,
		slaHours: category.slaHours,
		isActive: category.isActive,
	};

	const [updated] = await prisma.$transaction([
		prisma.category.update({
			where: { id },
			data: {
				name: payload.name,
				feeType: payload.feeType,
				feeAmount: nextFeeAmount,
				slaHours: payload.slaHours,
				isActive: payload.isActive,
			},
		}),
		prisma.auditLog.create({
			data: {
				actorId: actor.userId,
				action: "CATEGORY_UPDATED",
				entityType: "Category",
				entityId: id,
				previousValue,
				newValue: JSON.parse(JSON.stringify(payload)),
			},
		}),
	]);

	return updated;
};

// SOFT DELETE CATEGORY
const deleteCategory = async (id: string, actor: IRequestUser) => {
	const category = await prisma.category.findUnique({ where: { id } });

	if (!category || category.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Category not found");
	}

	const [deleted] = await prisma.$transaction([
		prisma.category.update({
			where: { id },
			data: { deletedAt: new Date(), isActive: false },
		}),
		prisma.auditLog.create({
			data: {
				actorId: actor.userId,
				action: "CATEGORY_DELETED",
				entityType: "Category",
				entityId: id,
				previousValue: { deletedAt: null, isActive: category.isActive },
				newValue: { deletedAt: new Date(), isActive: false },
			},
		}),
	]);

	return deleted;
};

export const CategoryService = {
	createCategory,
	getAllCategories,
	getSingleCategory,
	updateCategory,
	deleteCategory,
};
