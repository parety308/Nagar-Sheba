import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../lib/redis";


const createRedisStore = (prefix: string) =>
	new RedisStore({
		
		sendCommand: (...args: string[]) => redisClient.sendCommand(args),
		prefix,
	});


export const otpLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	store: createRedisStore("rl:otp:"),
	message: {
		success: false,
		message: "Too many attempts. Try again later.",
		errors: [],
	},
});

export const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	store: createRedisStore("rl:login:"),

	keyGenerator: (req) =>
    req.body?.email?.toLowerCase?.() || ipKeyGenerator(req.ip ?? "unknown"),
	message: {
		success: false,
		message: "Too many login attempts. Please try again in 15 minutes.",
		errors: [],
	},
});
