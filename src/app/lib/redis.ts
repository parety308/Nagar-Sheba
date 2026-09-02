import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
	socket: {
		host: config.redis.host,
		port: config.redis.port,
	},
	username: config.redis.username,
	password: config.redis.password,
});

redisClient.on("error", (err) => {
	console.error("Redis Client Error:", err);
});

redisClient.on("ready", () => {
	console.log("Redis connected successfully!");
});
