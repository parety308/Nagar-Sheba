
import config from "./app/config";
import { runRequestLifecycleJob } from "./app/jobs/requestLifecycle.job";
import { transport } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seed } from "./app/lib/seed";

const PORT = config.port;

const main = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");

    await redisClient.connect();
    console.log("Connected to Redis successfully.");

    const { default: app } = await import("./app");

    await seed();

    transport
      .verify()
      .then(() => console.log("Nodemailer Connected Successfully"))
      .catch((err) =>
        console.error("Nodemailer verification failed (continuing anyway):", err.message),
      );

    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

    runRequestLifecycleJob();
    setInterval(runRequestLifecycleJob, 15 * 60 * 1000);
  } catch (error) {
    console.error("Error starting the server:", error);
    if (redisClient.isOpen) await redisClient.quit();
    await prisma.$disconnect();
    process.exit(1);
  }
};

main();