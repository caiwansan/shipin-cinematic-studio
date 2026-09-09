const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const password = '<REDACTED>
  const hash = await bcrypt.hash(password, 10);
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hash },
    create: { username: 'admin', passwordHash: hash, role: 'super' }
  });
  console.log('Password reset successful');
  console.log('New password:', password);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
