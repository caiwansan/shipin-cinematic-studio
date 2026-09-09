const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // 找到表（im channel 相关 model）
  const models = Object.keys(p).filter(k => !k.startsWith('_') && typeof p[k] === 'object' && p[k].findFirst);
  console.log('models:', models.join(', '));
  for (const m of models) {
    try {
      const r = await p[m].findFirst({ where: { OR: [{ name: { contains: '客服群' } }, { title: { contains: '客服群' } }] } });
      if (r) { console.log('MATCH model=' + m, JSON.stringify(r).slice(0, 600)); break; }
    } catch (e) {}
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
