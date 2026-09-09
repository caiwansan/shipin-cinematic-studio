const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mobileId = '29720210-d4b6-47e8-9fce-53530cb2f642';
  const mobile = await prisma.user.findUnique({ where: { id: mobileId } });
  if (!mobile) { console.log('Mobile account not found'); return; }
  
  // Delete in correct order (respect foreign keys)
  await prisma.imTokenSession.deleteMany({ where: { userId: mobileId } });
  await prisma.userFollow.deleteMany({ where: { OR: [{ followerId: mobileId }, { followingId: mobileId }] } });
  
  // Delete coin_log first (references membership)
  await prisma.$executeRawUnsafe('DELETE FROM coin_log WHERE membership_id IN (SELECT id FROM membership WHERE user_id = $1::uuid)', mobileId);
  
  // Delete membership
  await prisma.membership.deleteMany({ where: { userId: mobileId } });
  
  // Delete tea_wallet
  await prisma.$executeRawUnsafe('DELETE FROM tea_wallet WHERE uid = $1::uuid', mobileId);
  
  // Delete user
  await prisma.user.delete({ where: { id: mobileId } });
  console.log('Deleted mobile account:', mobile.email);
  
  // Show null unionId accounts
  console.log('\n=== PC QQ accounts with null unionId ===');
  const nullUnion = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' }, qqUnionId: null },
    select: { id: true, email: true, username: true, qqOpenId: true }
  });
  nullUnion.forEach(u => console.log('  ' + u.email + ' | ' + u.username));
  console.log('Total:', nullUnion.length);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
