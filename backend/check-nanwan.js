const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'qq_6F736FAC37ED3A3AF774AE0924374F4D@aigc.fushtn.com' },
    select: { id: true, email: true, username: true, qqOpenId: true, qqUnionId: true }
  });
  if (user) {
    console.log('=== 南波万 ===');
    console.log('  id:', user.id);
    console.log('  email:', user.email);
    console.log('  username:', user.username);
    console.log('  qqOpenId:', user.qqOpenId);
    console.log('  qqUnionId:', user.qqUnionId || 'NULL');
  } else {
    console.log('NOT FOUND');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
