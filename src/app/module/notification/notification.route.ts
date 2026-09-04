import { Router } from "express";
import { auth } from "../../middleware/auth";
import { NotificationController } from "./notification.controller";

const router = Router();

router.get("/me", auth(), NotificationController.getMyNotifications);
router.get("/unread-count", auth(), NotificationController.getUnreadCount);
router.patch("/:id/read", auth(), NotificationController.markAsRead);
router.patch("/read-all", auth(), NotificationController.markAllAsRead);

export const NotificationRoutes = router;
