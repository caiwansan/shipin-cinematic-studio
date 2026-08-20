const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const phones = ['13900002222', '13900003333', '13900004444', '13900005555', '13900001111'];
  for (const ph of phones) {
    try {
      const u = await p.user.findFirst({ where: { phone: ph }, select: { id: true } });
      if (!u) { console.log('none', ph); continue; }
      try { await p.user.delete({ where: { id: u.id } }); console.log('deleted', u.id, ph); }
      catch (e) { console.log('delete err', ph, e.message.slice(0, 140)); }
    } catch (e) { console.log('q err', ph, e.message.slice(0, 100)); }
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
