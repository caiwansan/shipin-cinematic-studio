const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT id, username, phone, inviter_id, "avatarUrl" FROM "User" ORDER BY "createdAt" DESC LIMIT 5')
  .then(rows => { console.log(JSON.stringify(rows, null, 1)); process.exit(0); })
  .catch(e => { console.error('ERR', e.message); process.exit(1); });
