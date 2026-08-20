const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.$executeRawUnsafe(`ALTER TABLE city_post ADD COLUMN IF NOT EXISTS likes TEXT DEFAULT '[]'`);
  await p.$executeRawUnsafe(`ALTER TABLE city_post ADD COLUMN IF NOT EXISTS comments TEXT DEFAULT '[]'`);
  console.log('POST_COLS_ADDED');
  await p.$disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
