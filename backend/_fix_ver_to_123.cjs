const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
  if (!row) { console.log('NO ROW'); await prisma.$disconnect(); return; }
  const v = row.value;
  console.log('BEFORE latestVersion=', v.latestVersion, 'apkUrl=', v.apkUrl, 'versionCode=', v.versionCode);
  v.latestVersion = '1.2.3';
  v.apkUrl = 'https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.3.apk';
  if (v.versionCode !== undefined) v.versionCode = 1203;
  await prisma.routeConfig.update({ where: { scope_key: { scope: 'tea', key: 'config' } }, data: { value: v } });
  const back = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
  const v2 = back.value;
  console.log('AFTER latestVersion=', v2.latestVersion, 'apkUrl=', v2.apkUrl, 'versionCode=', v2.versionCode);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
