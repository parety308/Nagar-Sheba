import streamifier from "streamifier";
import cloudinary from "../lib/cloudinary";

export const uploadBufferToCloudinary = (
	buffer: Buffer,
	folder: string,
): Promise<{ secure_url: string; public_id: string }> => {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ folder, resource_type: "image" },
			(error, result) => {
				if (error || !result) return reject(error);
				resolve({ secure_url: result.secure_url, public_id: result.public_id });
			},
		);
		streamifier.createReadStream(buffer).pipe(stream);
	});
};

export const deleteFromCloudinary = async (publicId: string) => {
	try {
		await cloudinary.uploader.destroy(publicId);
	} catch (err) {
		console.error("Failed to delete old Cloudinary image:", err);
	}
};
