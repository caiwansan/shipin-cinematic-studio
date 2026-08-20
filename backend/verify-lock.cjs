const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // tamper attempt — must be 0 rows (locked)
  const r = await p.$executeRawUnsafe('UPDATE "User" SET inviter_id=\'aa10b164-04ac-4e7b-8479-7d2bfd828937\' WHERE id=\'5dd1648b-8d0d-4b96-9a6f-c925d3eaa42d\' AND inviter_id IS NULL');
  console.log('tamper rows (must be 0):', r);
  const u = await p.$queryRawUnsafe('SELECT inviter_id FROM "User" WHERE id=\'5dd1648b-8d0d-4b96-9a6f-c925d3eaa42d\'');
  console.log('inviter still locked:', JSON.stringify(u));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
