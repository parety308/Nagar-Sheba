import httpStatus from "http-status";
import multer from "multer";
import { AppError } from "../errors/AppError";

const storage = multer.memoryStorage();

export const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
	fileFilter: (_req, file, cb) => {
		if (!file.mimetype.startsWith("image/")) {
			return cb(
				new AppError(httpStatus.BAD_REQUEST, "Only image files are allowed"),
			);
		}
		cb(null, true);
	},
});
