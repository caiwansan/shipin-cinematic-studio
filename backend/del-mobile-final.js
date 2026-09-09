const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mobileId = '29720210-d4b6-47e8-9fce-53530cb2f642';
  const mobile = await prisma.user.findUnique({ where: { id: mobileId } });
  if (!mobile) { console.log('Mobile account not found'); return; }

  await prisma.imTokenSession.deleteMany({ where: { userId: mobileId } });
  await prisma.userFollow.deleteMany({ where: { OR: [{ followerId: mobileId }, { followingId: mobileId }] } });
  await prisma.coinLog.deleteMany({ where: { userId: mobileId } });
  await prisma.membership.deleteMany({ where: { userId: mobileId } });
  await prisma.goldCoinLog.deleteMany({ where: { userId: mobileId } });
  await prisma.giftRecord.deleteMany({ where: { OR: [{ senderId: mobileId }, { receiverId: mobileId }] } });
  await prisma.$executeRawUnsafe('DELETE FROM tea_wallet WHERE uid = $1', mobileId);
  await prisma.user.delete({ where: { id: mobileId } });
  console.log('Deleted mobile account:', mobile.email);

  const nullUnion = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' }, qqUnionId: null },
    select: { id: true, email: true, username: true, qqOpenId: true }
  });
  console.log('\n=== PC QQ accounts with null unionId ===');
  nullUnion.forEach(u => console.log('  ' + u.email + ' | ' + u.username));
  console.log('Total:', nullUnion.length);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
