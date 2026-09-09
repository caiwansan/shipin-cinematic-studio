const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cfg = await p.routeConfig.findFirst({ where: { scope: 'tea', key: 'config' } });
  if (!cfg) { console.log('NOT_FOUND'); process.exit(1); }
  const v = JSON.parse(JSON.stringify(cfg.value));
  v.apkSize = 50946788;
  v.apkSha256 = '81588a68718aa3b8c23ef9ef95354b241dc7a03e8eb8b46be79b534dbd0943be';
  v.updatedAt = '2026-08-27T06:20:00.000Z';
  const u = await p.routeConfig.update({ where: { id: cfg.id }, data: { value: v, updatedAt: new Date() } });
  console.log('routeConfig updated:', u.value.latestVersion, u.value.latestVersionCode, u.value.apkSize, u.value.apkSha256.slice(0, 12));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
