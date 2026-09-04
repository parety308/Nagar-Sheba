import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AdminRoutes } from "./app/module/admin/admin.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { CategoryRoutes } from "./app/module/category/category.route";
import { DepartmentRoutes } from "./app/module/department/department.route";
import { PaymentController } from "./app/module/payment/payment.controller";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { RequestRoutes } from "./app/module/request/request.route";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/departments", DepartmentRoutes);
app.use("/api/v1/categories", CategoryRoutes);
app.use("/api/v1/requests", RequestRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.use("/api/v1/payments", PaymentRoutes);

app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Nagar Sheba",
	});
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
