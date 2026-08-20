const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name='User' AND column_name ILIKE '%avatar%' OR (table_name='User' AND column_name ILIKE '%inviter%')")
  .then(rows => { console.log('avatar/inviter cols:', JSON.stringify(rows)); return p.$queryRawUnsafe('SELECT id, username, phone, inviter_id FROM "User" ORDER BY "createdAt" DESC LIMIT 5'); })
  .then(rows2 => { console.log('users:', JSON.stringify(rows2, null, 1)); process.exit(0); })
  .catch(e => { console.error('ERR', e.message); process.exit(1); });
