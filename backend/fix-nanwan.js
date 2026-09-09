const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Delete mobile duplicate account
  const mobileEmail = 'qq_64F878CD37EC2927791415F6E19F10FE@aigc.fushtn.com';
  const mobile = await prisma.user.findUnique({ where: { email: mobileEmail } });
  if (mobile) {
    await prisma.imTokenSession.deleteMany({ where: { userId: mobile.id } });
    await prisma.userFollow.deleteMany({ where: { OR: [{ followerId: mobile.id }, { followingId: mobile.id }] } });
    const membership = await prisma.membership.findUnique({ where: { userId: mobile.id } });
    if (membership) {
    await prisma.coinLog.deleteMany({ where: { userId: mobile.id } });
    await prisma.membership.delete({ where: { userId: mobile.id } });
  }
    await prisma.user.delete({ where: { id: mobile.id } });
    console.log('Deleted mobile:', mobileEmail);
  }
  
  // 2. Update 南波万 PC account with unionId
  const pcEmail = 'qq_6F736FAC37ED3A3AF774AE0924374F4D@aigc.fushtn.com';
  await prisma.user.update({
    where: { email: pcEmail },
    data: { qqUnionId: 'UID_A261C9352EBB20559C2B26AB374926F9' }
  });
  console.log('Updated unionId for:', pcEmail);
  
  // 3. Verify
  const updated = await prisma.user.findUnique({
    where: { email: pcEmail },
    select: { email: true, qqOpenId: true, qqUnionId: true }
  });
  console.log('Verified:', JSON.stringify(updated));
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
