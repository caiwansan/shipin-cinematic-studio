const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const qqUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true, email: true, qqOpenId: true, qqUnionId: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Total QQ users:', qqUsers.length);
  qqUsers.forEach(u => console.log('  ' + u.email + ' | union: ' + (u.qqUnionId || 'null') + ' | ' + u.createdAt));
  
  // Find the newly created mobile account for qq_64F878CD37EC2927791415F6E19F10FE
  const mobile = await prisma.user.findFirst({
    where: { email: { contains: '64F878CD' } },
    select: { id: true, email: true, qqOpenId: true, qqUnionId: true, createdAt: true }
  });
  if (mobile) {
    console.log('\nMobile account found:');
    console.log('  id:', mobile.id);
    console.log('  email:', mobile.email);
    console.log('  unionId:', mobile.qqUnionId || 'null');
    console.log('  created:', mobile.createdAt);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
