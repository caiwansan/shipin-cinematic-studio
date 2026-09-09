const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: { startsWith: 'qq_' } }, select: { id: true } });
  
  // Test creating a channel member
  try {
    const result = await prisma.imChannelMember.create({
      data: {
        channelId: 'kl_public_tea',
        channelType: 4,
        uid: user.id,
        role: 0,
        name: 'test',
        avatar: '',
      }
    });
    console.log('SUCCESS:', result.channelId, result.uid);
  } catch(e) {
    console.log('ERROR:', e.message.split('\n')[0]);
  }
  
  // Verify count
  const count = await prisma.imChannelMember.count();
  console.log('Total members:', count);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
