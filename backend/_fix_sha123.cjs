const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
  if (!row) { console.log('NO ROW'); await prisma.$disconnect(); return; }
  const v = row.value;
  v.latestVersion = '1.2.3';
  v.apkUrl = 'https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.3.apk';
  if (v.versionCode !== undefined) v.versionCode = 1203;
  if (v.versionName !== undefined) v.versionName = '1.2.3';
  v.apkSha256 = '2918cbc2dce898212fd3418bf67cec673ee6b339b652802974eaf57de849d0fe';
  v.apkSize = 50935320;
  await prisma.routeConfig.update({ where: { scope_key: { scope: 'tea', key: 'config' } }, data: { value: v } });
  const back = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
  console.log('AFTER:', JSON.stringify(back.value));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
