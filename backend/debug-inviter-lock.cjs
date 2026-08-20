const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.$queryRawUnsafe('SELECT id,username,"marketAgentId",inviter_id FROM "User" WHERE phone=\'13900002222\'');
  console.log('new user:', JSON.stringify(u));
  const agent = await p.$queryRawUnsafe('SELECT id,username FROM "User" WHERE id=\'2af35345-8f1b-49ed-87da-ce3ee445f02b\'');
  console.log('agent:', JSON.stringify(agent));
  const test = await p.$executeRawUnsafe('UPDATE "User" SET inviter_id=\'2af35345-8f1b-49ed-87da-ce3ee445f02b\' WHERE id=\'bb2ed3ac-dd91-49e7-9d57-b7e32e9af301\' AND inviter_id IS NULL');
  console.log('manual lock rows:', test);
  const u2 = await p.$queryRawUnsafe('SELECT inviter_id FROM "User" WHERE id=\'bb2ed3ac-dd91-49e7-9d57-b7e32e9af301\'');
  console.log('after manual lock:', JSON.stringify(u2));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
