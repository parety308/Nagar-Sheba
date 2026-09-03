import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
	ICreateDepartmentPayload,
	IDepartmentQuery,
	IUpdateDepartmentPayload,
} from "./department.interface";

// CREATE DEPARTMENT

const createDepartment = async (payload: ICreateDepartmentPayload) => {
	const existingDepartment = await prisma.department.findUnique({
		where: { name: payload.name },
	});

	if (existingDepartment) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"A department with this name already exists",
		);
	}

	const department = await prisma.department.create({
		data: {
			name: payload.name,
			description: payload.description,
		},
	});

	return department;
};

// get all department (paginated)

const getAllDepartments = async (
	query: IDepartmentQuery,
	requesterRole?: Role,
) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
	const skip = (page - 1) * limit;

	// Only an Admin may ask to see soft-deleted departments
	const includeInactive =
		requesterRole === Role.ADMIN && !!query.includeInactive;

	const where = includeInactive ? {} : { deletedAt: null };

	const [departments, total] = await Promise.all([
		prisma.department.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.department.count({ where }),
	]);

	return {
		data: departments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit) || 1,
		},
	};
};

// get single department

const getSingleDepartment = async (id: string) => {
	const department = await prisma.department.findUnique({
		where: { id },
	});

	if (!department || department.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	return department;
};

//update department

const updateDepartment = async (
	id: string,
	payload: IUpdateDepartmentPayload,
) => {
	const department = await prisma.department.findUnique({ where: { id } });

	if (!department || department.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	if (payload.name && payload.name !== department.name) {
		const nameTaken = await prisma.department.findUnique({
			where: { name: payload.name },
		});

		if (nameTaken) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"A department with this name already exists",
			);
		}
	}

	const updated = await prisma.department.update({
		where: { id },
		data: {
			name: payload.name,
			description: payload.description,
		},
	});

	return updated;
};

// soft deleted department

const deleteDepartment = async (id: string) => {
	const department = await prisma.department.findUnique({ where: { id } });

	if (!department || department.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	const [activeCategoryCount, activeStaffCount, openRequestCount] =
		await Promise.all([
			prisma.category.count({
				where: { departmentId: id, deletedAt: null },
			}),
			prisma.staffProfile.count({ where: { departmentId: id } }),
			prisma.serviceRequest.count({
				where: {
					departmentId: id,
					status: { notIn: ["CLOSED", "CANCELLED"] },
				},
			}),
		]);

	if (activeCategoryCount > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete a department that still has active categories. Soft-delete or move its categories first.",
		);
	}

	if (activeStaffCount > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete a department that still has staff assigned to it. Reassign its staff first.",
		);
	}

	if (openRequestCount > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete a department with open (non-closed) service requests.",
		);
	}

	const deleted = await prisma.department.update({
		where: { id },
		data: { deletedAt: new Date() },
	});

	return deleted;
};

export const DepartmentService = {
	createDepartment,
	getAllDepartments,
	getSingleDepartment,
	updateDepartment,
	deleteDepartment,
};
