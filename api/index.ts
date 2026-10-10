import { prisma } from "../src/app/lib/prisma";
import { redisClient } from "../src/app/lib/redis";

await prisma.$connect();
if (!redisClient.isOpen) await redisClient.connect();

const { default: app } = await import("../src/app");

export default app;