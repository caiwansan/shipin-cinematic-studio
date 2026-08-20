const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    await p.$executeRawUnsafe(`ALTER TABLE tea_post ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'public'`);
    console.log('SCOPE_COL_ADDED');
  } catch (e) { console.log('ERR', e.message); }
  await p.$disconnect();
})();
