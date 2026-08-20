const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT id, "marketAgentId", inviter_id FROM "User" WHERE phone=\'13900005555\'')
  .then(r => { console.log(JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.error('ERR', e.message); process.exit(1); });
