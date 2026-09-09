const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mobileId = '29720210-d4b6-47e8-9fce-53530cb2f642';
  const mobile = await prisma.user.findUnique({ where: { id: mobileId } });
  if (mobile) {
    await prisma.imTokenSession.deleteMany({ where: { userId: mobileId } });
    await prisma.userFollow.deleteMany({ where: { OR: [{ followerId: mobileId }, { followingId: mobileId }] } });
    const membership = await prisma.membership.findUnique({ where: { userId: mobileId } });
    if (membership) await prisma.membership.delete({ where: { userId: mobileId } });
    await prisma.$executeRawUnsafe('DELETE FROM tea_wallet WHERE uid = $1', mobileId);
    await prisma.user.delete({ where: { id: mobileId } });
    console.log('Deleted mobile account:', mobile.email);
  }
  
  console.log('\\n=== PC QQ accounts with null unionId ===');
  const nullUnion = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' }, qqUnionId: null },
    select: { id: true, email: true, username: true, qqOpenId: true }
  });
  nullUnion.forEach(u => console.log('  ' + u.email + ' | ' + u.username));
  console.log('Total null unionId:', nullUnion.length);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
