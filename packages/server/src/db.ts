import { PrismaClient } from '@prisma/client';

// Single Prisma client for the process. Reads DATABASE_URL via the schema's datasource.
export const prisma = new PrismaClient();
