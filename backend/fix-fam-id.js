const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    await p.$executeRawUnsafe(`ALTER TABLE family_post ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`);
    console.log('ID_DEFAULT_OK');
  } catch (e) { console.log('ERR', e.message); }
  await p.$disconnect();
})();
