import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { DepartmentService } from "./department.service";

// create department
const createDepartment = catchAsync(async (req: Request, res: Response) => {
	const result = await DepartmentService.createDepartment(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Department created successfully",
		data: result,
	});
});

// get all departments
const getAllDepartments = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser | undefined;

	const result = await DepartmentService.getAllDepartments(
		{
			page: Number(req.query.page),
			limit: Number(req.query.limit),
			includeInactive: req.query.includeInactive === "true",
		},
		user?.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Departments fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

// get signle department
const getSingleDepartment = catchAsync(async (req: Request, res: Response) => {
	const result = await DepartmentService.getSingleDepartment(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department fetched successfully",
		data: result,
	});
});

// update department
const updateDepartment = catchAsync(async (req: Request, res: Response) => {
	const result = await DepartmentService.updateDepartment(
		req.params.id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department updated successfully",
		data: result,
	});
});

// delete soft department
const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
	const result = await DepartmentService.deleteDepartment(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department deleted successfully",
		data: result,
	});
});

export const DepartmentController = {
	createDepartment,
	getAllDepartments,
	getSingleDepartment,
	updateDepartment,
	deleteDepartment,
};
