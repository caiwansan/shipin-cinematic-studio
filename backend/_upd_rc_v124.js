const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cfg = await p.routeConfig.findFirst({ where: { scope: 'tea', key: 'config' } });
  if (!cfg) { console.log('NOT_FOUND'); process.exit(1); }
  const v = JSON.parse(JSON.stringify(cfg.value));
  v.latestVersion = '1.2.4';
  v.latestVersionCode = '1204';
  v.apkUrl = 'https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.4.apk';
  v.apkSize = 50905828;
  v.apkSha256 = 'b8a3fc2e4424fed3b214fce382435b9f2aba6163c36b8e3c3e7b9926abde3d43';
  v.updatedAt = '2026-08-27T03:30:00.000Z';
  const u = await p.routeConfig.update({ where: { id: cfg.id }, data: { value: v, updatedAt: new Date() } });
  console.log('routeConfig updated:', u.value.latestVersion, u.value.latestVersionCode, u.value.apkSha256.slice(0, 12));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
