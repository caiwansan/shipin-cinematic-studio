const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const t of ['city_post', 'family_post']) {
    try { await p.$executeRawUnsafe(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS sig TEXT DEFAULT ''`); } catch (e) { console.log(t, 'sig ERR', e.message); }
    try { await p.$executeRawUnsafe(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS pub_key TEXT DEFAULT ''`); } catch (e) { console.log(t, 'pub ERR', e.message); }
  }
  console.log('ALTER_DONE');
  await p.$disconnect();
})();
