import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const users = await prisma.adminUser.findMany({ select: { id: true, username: true, displayName: true, role: true, enabled: true } });
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
