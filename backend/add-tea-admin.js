const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const t of ['tea_admin', 'tea_ban']) {
    try { await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${t} (uid TEXT PRIMARY KEY, by TEXT DEFAULT '', reason TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now())`); console.log(t, 'OK'); }
    catch (e) { console.log(t, 'ERR', e.message); }
  }
  try { await p.$executeRawUnsafe(`ALTER TABLE tea_post ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false`); console.log('deleted OK'); }
  catch (e) { console.log('deleted ERR', e.message); }
  try { await p.$executeRawUnsafe(`INSERT INTO tea_admin (uid, by) VALUES ('0ba5bf98-7005-4019-a431-6a0fb4b2d28d', 'seed') ON CONFLICT DO NOTHING`); console.log('seed OK'); }
  catch (e) { console.log('seed ERR', e.message); }
  await p.$disconnect();
})();
