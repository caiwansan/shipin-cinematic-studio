const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: { startsWith: 'qq_' } }, select: { id: true } });
  
  try {
    const result = await prisma.imMessageIndex.create({
      data: {
        messageId: 'test_123',
        fromUid: user.id,
        channelId: 'test_channel',
        channelType: 4,
      }
    });
    console.log('SUCCESS:', result.messageId);
  } catch(e) {
    console.log('ERROR:', e.message);
    console.log('CODE:', e.code);
    console.log('META:', JSON.stringify(e.meta));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
