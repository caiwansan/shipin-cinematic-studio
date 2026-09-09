const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rc = await p.routeConfig.findFirst({ where: { scope: 'tea', key: 'config' } });
  console.log('routeConfig keys:', rc ? Object.keys(rc.value).sort().join(', ') : 'NONE');
  console.log('routeConfig qq*:', rc ? JSON.stringify(Object.fromEntries(Object.entries(rc.value).filter(([k]) => k.toLowerCase().includes('qq')))) : '-');
  const ps = await p.paymentSecret.findMany();
  ps.forEach(r => console.log('paymentSecret:', r.channel, 'enabled=', r.enabled, 'config=', String(r.config || '').slice(0, 400)));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
