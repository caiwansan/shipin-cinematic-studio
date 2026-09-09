const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.imGroup.findFirst({ where: { name: { contains: '客服群' } } });
  if (r) { console.log(JSON.stringify(r).slice(0, 800)); }
  else {
    const r2 = await p.imGroup.findFirst();
    console.log('no match; sample:', JSON.stringify(r2).slice(0, 800));
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
