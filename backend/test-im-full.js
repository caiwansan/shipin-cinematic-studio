const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: { startsWith: 'qq_' } }, select: { id: true } });
  const channelId = 'test_' + Date.now();
  
  // Send message
  const payload = Buffer.from(JSON.stringify({ type: 1, content: 'Hello' })).toString('base64');
  const msgRes = await fetch('http://127.0.0.1:5001/message/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4, from_uid: user.id, payload })
  });
  const msgResult = await msgRes.text();
  const parsed = JSON.parse(msgResult);
  
  console.log('Message ID:', parsed.data.message_id, 'Type:', typeof parsed.data.message_id);
  
  // Try creating im_message_index with String conversion
  try {
    const result = await prisma.imMessageIndex.create({
      data: {
        messageId: String(parsed.data.message_id),
        fromUid: user.id,
        channelId,
        channelType: 4,
      }
    });
    console.log('SUCCESS:', result.messageId);
  } catch(e) {
    console.log('ERROR Code:', e.code);
    console.log('ERROR Message:', e.message);
    console.log('ERROR Meta:', JSON.stringify(e.meta));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
