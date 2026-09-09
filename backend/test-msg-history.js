const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the channel we created in previous test
  const recentMsg = await prisma.imMessageIndex.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { channelId: true, messageId: true }
  });
  
  if (!recentMsg) {
    console.log('No messages found');
    return;
  }
  
  console.log('Channel:', recentMsg.channelId);
  console.log('Message ID:', recentMsg.messageId);
  
  // Fetch from WukongIM
  const res = await fetch('http://127.0.0.1:5001/channel/messagesync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel_id: recentMsg.channelId,
      channel_type: 4,
      start_message_seq: 0,
      limit: 10,
      pull_mode: 1
    })
  });
  
  const data = await res.json();
  console.log('\nWukongIM messages:', data.messages?.length || 0);
  
  if (data.messages?.length > 0) {
    const msg = data.messages[0];
    console.log('\nFirst message:');
    console.log('  from_uid:', msg.from_uid);
    console.log('  payload:', msg.payload);
    console.log('  payload type:', typeof msg.payload);
    
    // Decode payload
    if (msg.payload) {
      const raw = Buffer.from(msg.payload, 'base64');
      const text = raw.toString('utf8');
      console.log('  decoded text:', text);
      try {
        const obj = JSON.parse(text);
        console.log('  parsed object:', JSON.stringify(obj));
      } catch(e) {
        console.log('  parse error:', e.message);
      }
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
