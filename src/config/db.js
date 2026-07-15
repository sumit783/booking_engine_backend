import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["query", "info", "warn", "error"],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("✅ MySQL connected via Prisma");
    return prisma;
  } catch (error) {
    console.error(`❌ MySQL connection error via Prisma: ${error.message}`);
    throw error;
  }
};

export { prisma };
export default connectDB;
