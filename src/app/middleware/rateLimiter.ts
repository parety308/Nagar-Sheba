import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../lib/redis";

// Shared Redis-backed store factory.
//
// express-rate-limit defaults to an in-memory store, which resets on every
// cold start and is NOT shared across instances. On serverless platforms
// (Vercel Functions) each invocation can be a fresh process, so an
// in-memory limiter effectively never limits anything in production.
// Redis gives every instance a single shared counter.
const createRedisStore = (prefix: string) =>
	new RedisStore({
		// rate-limit-redis expects a `sendCommand` function; node-redis v4+/v6
		// exposes this directly via `redisClient.sendCommand`.
		sendCommand: (...args: string[]) => redisClient.sendCommand(args),
		prefix,
	});

// OTP-related endpoints (registration, forgot-password) — low ceiling,
// since these trigger an email send and a Redis-stored OTP each time.
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

// Login — protects against credential brute-forcing. Slightly more
// generous than the OTP limiter since legitimate users mistype passwords
// more often than they need a fresh OTP.
export const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	store: createRedisStore("rl:login:"),
	// Rate-limit by email when present, falling back to IP, so a shared
	// office/NAT IP with several legitimate users isn't punished as a unit
	// on top of per-account brute-force protection.
	keyGenerator: (req) =>
    req.body?.email?.toLowerCase?.() || ipKeyGenerator(req.ip ?? "unknown"),
	message: {
		success: false,
		message: "Too many login attempts. Please try again in 15 minutes.",
		errors: [],
	},
});
