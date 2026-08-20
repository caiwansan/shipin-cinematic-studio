const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const phones = ['13900002222', '13900003333', '13900004444', '13900005555', '13900001111'];
  for (const ph of phones) {
    const r = await p.$executeRawUnsafe('UPDATE "User" SET inviter_id = NULL, "marketAgentId" = NULL WHERE phone = $1', ph);
    console.log('cleared', ph, 'rows', r);
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
