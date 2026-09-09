const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  // Get two users
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true },
    take: 2
  });
  
  if (users.length < 2) { console.log('Need 2 users, found:', users.length); return; }
  
  const [user1, user2] = users;
  console.log('User1:', user1.id);
  console.log('User2:', user2.id);
  
  // Create private channel
  const channelId = 'dm_' + [user1.id, user2.id].sort().join('_');
  console.log('\nChannel:', channelId);
  
  // Add subscribers in WukongIM
  await fetch('http://127.0.0.1:5001/channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4 })
  });
  
  const subRes = await fetch('http://127.0.0.1:5001/channel/subscriber_add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4, subscribers: [user1.id, user2.id] })
  });
  console.log('Subscribers:', subRes.status);
  
  // Create channel members (like ensureMember)
  await prisma.imChannelMember.createMany({
    data: [
      { channelId, channelType: 4, uid: user1.id, role: 0, name: 'User1', avatar: '' },
      { channelId, channelType: 4, uid: user2.id, role: 0, name: 'User2', avatar: '' },
    ],
    skipDuplicates: true,
  });
  console.log('Channel members created');
  
  // Send message from user1
  const payload = Buffer.from(JSON.stringify({ type: 1, content: 'Hello from User1' })).toString('base64');
  const msgRes = await fetch('http://127.0.0.1:5001/message/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4, from_uid: user1.id, payload })
  });
  const msgData = await msgRes.json();
  console.log('\nMessage sent:', msgData.status);
  
  // Verify channel members for user1
  const members = await prisma.imChannelMember.findMany({
    where: { uid: user1.id },
    select: { channelId: true, uid: true }
  });
  console.log('\nUser1 channels:', members.length);
  
  // Fetch message history
  const histRes = await fetch('http://127.0.0.1:5001/channel/messagesync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4, start_message_seq: 0, limit: 10, pull_mode: 1 })
  });
  const histData = await histRes.json();
  console.log('\nHistory messages:', histData.messages?.length || 0);
  if (histData.messages?.length > 0) {
    const msg = histData.messages[0];
    const decoded = JSON.parse(Buffer.from(msg.payload, 'base64').toString('utf8'));
    console.log('Content:', decoded.content);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
