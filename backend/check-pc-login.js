const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check all users with openId containing 6F736FAC
  const users = await prisma.user.findMany({
    where: { qqOpenId: { contains: '6F736FAC' } },
    select: { id: true, email: true, username: true, qqOpenId: true, qqUnionId: true, createdAt: true }
  });
  console.log('Users with 6F736FAC:');
  users.forEach(u => console.log('  ' + JSON.stringify(u)));
  
  // Check total user count
  const count = await prisma.user.count();
  console.log('\nTotal users:', count);
  
  // Check recent users
  const recent = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, email: true, username: true, qqOpenId: true, qqUnionId: true, createdAt: true }
  });
  console.log('\nRecent users:');
  recent.forEach(u => console.log('  ' + u.email + ' | ' + u.qqOpenId + ' | union: ' + (u.qqUnionId || 'null') + ' | ' + u.createdAt));
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
