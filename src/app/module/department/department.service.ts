import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
	ICreateDepartmentPayload,
	IDepartmentQuery,
	IUpdateDepartmentPayload,
} from "./department.interface";

// create a new dept
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
