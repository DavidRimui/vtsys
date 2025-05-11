import { PrismaClient } from "@prisma/client"
import { getDatabaseUrl } from "./database-config"

// Prisma configuration for high concurrency
const prismaClientSingleton = () => {
  // Get the appropriate database URL based on environment
  const databaseUrl = getDatabaseUrl();
  
  return new PrismaClient({
    // Optimize for high-traffic scenarios
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // Configure connection pooling for high concurrency
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    // PrismaClient in latest versions doesn't accept connectionTimeout directly here
    // Connection timeout can be configured via the DATABASE_URL connection string
  })
  // Custom extensions can be added later if needed
  // For now, we're using the standard Prisma client for compatibility
}

// Use type for global singleton to prevent multiple instances
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

// Create and export a singleton Prisma client to prevent connection exhaustion
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

// In development, keep the client alive between hot reloads
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
