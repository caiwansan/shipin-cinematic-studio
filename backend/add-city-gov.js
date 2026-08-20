const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.$executeRawUnsafe(`ALTER TABLE city ADD COLUMN IF NOT EXISTS pub_all_muted BOOLEAN DEFAULT false`);
  await p.$executeRawUnsafe(`ALTER TABLE city ADD COLUMN IF NOT EXISTS pub_allow_image BOOLEAN DEFAULT true`);
  await p.$executeRawUnsafe(`ALTER TABLE city ADD COLUMN IF NOT EXISTS pub_allow_video BOOLEAN DEFAULT true`);
  await p.$executeRawUnsafe(`ALTER TABLE city ADD COLUMN IF NOT EXISTS pub_allow_file BOOLEAN DEFAULT true`);
  await p.$executeRawUnsafe(`ALTER TABLE city_member ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT false`);
  console.log('CITY_GOV_COLS_ADDED');
  await p.$disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
