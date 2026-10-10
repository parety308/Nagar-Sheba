import { prisma } from "./app/lib/prisma";
import { seed } from "./app/lib/seed";
import { seedDemoData } from "./app/lib/seedDemoData";

const main = async () => {
	try {
		await prisma.$connect();

		await seed();
		await seedDemoData();

		console.log("Database seeding completed successfully.");
	} catch (error) {
		console.error("Database seeding failed:", error);
		process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
};

main();
