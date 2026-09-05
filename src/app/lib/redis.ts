import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
	socket: {
		host: config.redis.host,
		port: config.redis.port,
		tls: true, // required by most managed Redis providers (Upstash, Render Key Value external endpoint)
		reconnectStrategy: (retries) => {
			if (retries > 20) {
				console.error("Redis: too many reconnection attempts, giving up.");
				return new Error("Redis reconnection failed");
			}
			return Math.min(retries * 100, 3000); // capped exponential backoff
		},
	},
	username: config.redis.username,
	password: config.redis.password,
});

redisClient.on("error", (err) => {
	console.error("Redis Client Error:", err);
});

redisClient.on("reconnecting", () => {
	console.log("Redis reconnecting...");
});

redisClient.on("ready", () => {
	console.log("Redis connected successfully!");
});