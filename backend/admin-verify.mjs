import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const user = await prisma.adminUser.findUnique({ where: { id: 1 } });
const valid = await bcrypt.compare('caiwp-1980', user.passwordHash);
console.log('密码验证:', valid ? '✅ 通过' : '❌ 失败');
await prisma.$disconnect();
