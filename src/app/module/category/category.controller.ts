import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { CategoryService } from "./category.service";

// CREATE CATEGORY

const createCategory = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await CategoryService.createCategory(req.body, actor);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Category created successfully",
		data: result,
	});
});

// GET ALL CATEGORIES

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser | undefined;

	const result = await CategoryService.getAllCategories(
		{
			page: Number(req.query.page),
			limit: Number(req.query.limit),
			departmentId: req.query.departmentId as string | undefined,
			includeInactive: req.query.includeInactive === "true",
		},
		user?.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Categories fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

// GET SINGLE CATEGORY

const getSingleCategory = catchAsync(async (req: Request, res: Response) => {
	const result = await CategoryService.getSingleCategory(
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Category fetched successfully",
		data: result,
	});
});

// UPDATE CATEGORY

const updateCategory = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await CategoryService.updateCategory(
		req.params.id as string,
		req.body,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Category updated successfully",
		data: result,
	});
});

// DELETE (SOFT) CATEGORY

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await CategoryService.deleteCategory(
		req.params.id as string,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Category deleted successfully",
		data: result,
	});
});

export const CategoryController = {
	createCategory,
	getAllCategories,
	getSingleCategory,
	updateCategory,
	deleteCategory,
};
