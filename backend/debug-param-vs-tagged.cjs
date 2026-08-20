const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.$queryRawUnsafe('SELECT id, "marketAgentId", inviter_id FROM "User" WHERE phone IN (\'13900004444\',\'13900003333\',\'13900002222\')');
  console.log('users:', JSON.stringify(u, null, 1));
  // try manual executeRaw with $1 params (same as code path)
  try {
    const r = await p.$executeRawUnsafe('UPDATE "User" SET inviter_id = $1 WHERE id = $2 AND inviter_id IS NULL', '2af35345-8f1b-49ed-87da-ce3ee445f02b', '1e09dafb-92c5-4b52-b27d-b592e6efa990');
    console.log('param UPDATE rows:', r);
  } catch (e) { console.log('param UPDATE ERR:', e.message); }
  // tagged template
  try {
    const r = await p.$executeRaw`UPDATE "User" SET inviter_id = ${'2af35345-8f1b-49ed-87da-ce3ee445f02b'} WHERE id = ${'1e09dafb-92c5-4b52-b27d-b592e6efa990'} AND inviter_id IS NULL`;
    console.log('tagged UPDATE rows:', r);
  } catch (e) { console.log('tagged UPDATE ERR:', e.message); }
  const u2 = await p.$queryRawUnsafe('SELECT inviter_id FROM "User" WHERE id=\'1e09dafb-92c5-4b52-b27d-b592e6efa990\'');
  console.log('after:', JSON.stringify(u2));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
