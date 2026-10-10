
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import httpStatus from "http-status";
import { RedisStore } from "rate-limit-redis";

import config from "./app/config";
import { redisClient } from "./app/lib/redis";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";

import { AdminRoutes } from "./app/module/admin/admin.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { CategoryRoutes } from "./app/module/category/category.route";
import { DepartmentRoutes } from "./app/module/department/department.route";
import { FeedbackRoutes } from "./app/module/feedback/feedback.route";
import { NotificationRoutes } from "./app/module/notification/notification.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { PublicRoutes } from "./app/module/public/public.route";
import { RequestRoutes } from "./app/module/request/request.route";

const app: Application = express();

// Trust the first proxy in front of the application.
// Verify this setting against your actual production proxy topology.
app.set("trust proxy", 1);

app.use(helmet());

// Global rate limiter
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1500,
        standardHeaders: true,
        legacyHeaders: false,

        // Do not count frequent authentication-status checks
        // against the global IP-based rate limit.
        skip: (req: Request) =>
            req.path === "/api/v1/auth/me" ||
            req.path === "/auth/me",

        store: new RedisStore({
            sendCommand: (...args: string[]) =>
                redisClient.sendCommand(args),
            prefix: "rl:global:",
        }),
    }),
);

// CORS
app.use(
    cors({
        origin: config.frontend_url,
        credentials: true,
    }),
);

// Body parsers and cookies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/departments", DepartmentRoutes);
app.use("/api/v1/categories", CategoryRoutes);
app.use("/api/v1/requests", RequestRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/feedbacks", FeedbackRoutes);
app.use("/api/v1/notifications", NotificationRoutes);
app.use("/api/v1/public", PublicRoutes);

// Health check
app.get("/", (_req: Request, res: Response) => {
    res.status(httpStatus.OK).json({
        success: true,
        message: "Welcome to Nagar Sheba",
    });
});

// Error handling
app.use(notFound);
app.use(globalErrorHandler);

export default app;