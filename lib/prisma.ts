import { PrismaClient } from '@prisma/client';

// Use a singleton pattern to avoid multiple Prisma Client instances
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, use a global variable to prevent multiple instances
  const globalForPrisma = global as unknown as { prisma?: PrismaClient };
  
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  
  prisma = globalForPrisma.prisma;
}

export default prisma;
