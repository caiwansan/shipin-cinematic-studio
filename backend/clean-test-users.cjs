const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const phones = ['13900002222', '13900003333', '13900004444', '13900005555', '13900001111'];
  for (const ph of phones) {
    try {
      const ids = await p.$queryRawUnsafe('SELECT id FROM "User" WHERE phone = $1', ph);
      for (const u of ids) {
        try { await p.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', u.id); console.log('deleted', u.id, ph); }
        catch (e) { console.log('skip', u.id, e.message.slice(0, 100)); }
      }
    } catch (e) { console.log('q err', ph, e.message.slice(0, 100)); }
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
