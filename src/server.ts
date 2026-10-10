import cron from "node-cron";
import config from "./app/config";
import { runRequestLifecycleJob } from "./app/jobs/requestLifecycle.job";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";

const PORT = config.port;

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");

		await redisClient.connect();
		console.log("Connected to Redis successfully.");

		const { default: app } = await import("./app");

		app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

		runRequestLifecycleJob();
		cron.schedule("*/15 * * * *", runRequestLifecycleJob);
	} catch (error) {
		console.error("Error starting the server:", error);
		if (redisClient.isOpen) await redisClient.quit();
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();
