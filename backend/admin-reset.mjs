import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const newPassword = 'caiwp-1980';
const passwordHash = await bcrypt.hash(newPassword, 10);

const result = await prisma.adminUser.update({
  where: { id: 1 },
  data: { passwordHash },
  select: { id: true, username: true, displayName: true, role: true, enabled: true }
});

console.log('✅ 密码已重置');
console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
