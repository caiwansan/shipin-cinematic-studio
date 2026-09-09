const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  // Get a real user
  const user = await prisma.user.findFirst({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true }
  });
  
  if (!user) { console.log('No user found'); return; }
  
  // Create a test channel
  const channelId = 'test_' + Date.now();
  
  // Create channel in WukongIM
  const chRes = await fetch('http://127.0.0.1:5001/channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4 })
  });
  console.log('Channel:', chRes.status);
  
  // Add subscriber
  const subRes = await fetch('http://127.0.0.1:5001/channel/subscriber_add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4, subscribers: [user.id] })
  });
  console.log('Subscriber:', subRes.status);
  
  // Send message with base64 payload
  const payload = Buffer.from(JSON.stringify({ type: 1, content: 'Hello from test' })).toString('base64');
  const msgRes = await fetch('http://127.0.0.1:5001/message/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4, from_uid: user.id, payload })
  });
  const msgResult = await msgRes.text();
  console.log('Message send:', msgRes.status, msgResult);
  
  // Try to create im_message_index record
  try {
    const result = await prisma.imMessageIndex.create({
      data: {
        messageId: JSON.parse(msgResult).data?.message_id || 'test',
        fromUid: user.id,
        channelId,
        channelType: 4,
      }
    });
    console.log('im_message_index created:', result.messageId);
  } catch(e) {
    console.log('im_message_index ERROR:', e.message.split('\n')[0]);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
