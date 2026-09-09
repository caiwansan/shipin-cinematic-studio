const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
  if (!row) { console.log('NO ROW'); await prisma.$disconnect(); return; }
  const v = row.value;
  v.latestVersion = '1.2.3';
  v.latestVersionCode = '1203';
  v.apkUrl = 'https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.3.apk';
  await prisma.routeConfig.update({ where: { scope_key: { scope: 'tea', key: 'config' } }, data: { value: v } });
  const back = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
  console.log('AFTER:', JSON.stringify(back.value));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
