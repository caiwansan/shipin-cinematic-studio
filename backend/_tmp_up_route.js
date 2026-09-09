
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // 1. 更新正确的行 scope=tea key=config → 1.2.2
  const upd = await prisma.routeConfig.update({
    where: { id: 'cmsur6b4p0000cljx7pi2k6vu' },
    data: { value: {
      latestVersion: '1.2.2',
      apkUrl: 'https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.2.apk',
      updatedAt: new Date().toISOString(),
    } },
  });
  console.log('UPDATED id=' + upd.id + ' version=' + upd.value.latestVersion);
  // 2. 删除误建的 tea/config 行
  try {
    const del = await prisma.routeConfig.delete({ where: { id: 'cmt5atpin0000cld2lxms21wz' } });
    console.log('DELETED id=' + del.id);
  } catch(e) {
    console.log('delete skip: ' + e.message);
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERR', e.code, e.message); await prisma.$disconnect(); process.exit(1); });

