import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
	node_env: process.env.NODE_ENV,
	port: process.env.PORT,
	database_url: process.env.DATABASE_URL,
	backend_url: process.env.BACKEND_URL,
	frontend_url: process.env.FRONTEND_URL,
	bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS),
	jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
	jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
	jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
	jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
	google_client_id: process.env.GOOGLE_CLIENT_ID!,
	admin: {
		email: process.env.ADMIN_EMAIL!,
		password: process.env.ADMIN_PASSWORD!,
	},
	redis: {
		username: process.env.REDIS_USERNAME!,
		password: process.env.REDIS_PASSWORD!,
		host: process.env.REDIS_HOST!,
		port: Number(process.env.REDIS_PORT),
	},
	staff_password: process.env.STAFF_PASSWORD!,
	smtp: {
		user: process.env.SMTP_USER!,
		sender: process.env.SMTP_SENDER!,
		password: process.env.SMTP_PASSWORD!,
	},
	cloudinary: {
		cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
		api_key: process.env.CLOUDINARY_API_KEY!,
		api_secret: process.env.CLOUDINARY_API_SECRET!,
	},
	sslcommerz: {
		store_id: process.env.SSLCOMMERZ_STORE_ID!,
		store_password: process.env.SSLCOMMERZ_STORE_PASSWORD!,
		is_live: process.env.SSLCOMMERZ_IS_LIVE === "true",
	},
	bkash: {
		base_url: process.env.BKASH_BASE_URL!,
		username: process.env.BKASH_USERNAME!,
		password: process.env.BKASH_PASSWORD!,
		app_key: process.env.BKASH_APP_KEY!,
		app_secret: process.env.BKASH_APP_SECRET!,
	},
};
