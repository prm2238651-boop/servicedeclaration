import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  policePrisma?: PrismaClient;
};

export const prisma = globalForPrisma.policePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.policePrisma = prisma;
