const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cfg = await p.routeConfig.findFirst({ where: { scope: 'tea', key: 'config' } });
  if (!cfg) { console.log('NOT_FOUND'); process.exit(1); }
  const v = JSON.parse(JSON.stringify(cfg.value));
  v.apkSize = 50946788;
  v.apkSha256 = '553c0bc6b1614f888cd0c9f736ecfcd09514b2aa2edf581a095dc3e6dfbb788d';
  v.updatedAt = '2026-08-27T04:30:00.000Z';
  const u = await p.routeConfig.update({ where: { id: cfg.id }, data: { value: v, updatedAt: new Date() } });
  console.log('routeConfig updated:', u.value.latestVersion, u.value.latestVersionCode, u.value.apkSize, u.value.apkSha256.slice(0, 12));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
