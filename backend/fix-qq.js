
const { prisma } = require('/root/shipin-cinematic-studio/backend/src/utils/index.js');
async function main() {
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
  if (row) {
    const v = row.value || {};
    v.qqAppId = '1905458744';
    v.qqAppSecret = 'gJkz2tXzEH7kBPQS';
    v.qqRedirectUri = 'kunlun://auth/qq/callback';
    await prisma.routeConfig.update({ where: { id: row.id }, data: { value: v } });
    console.log('Updated:', JSON.stringify(v, null, 2));
  }
  await prisma.$disconnect();
}
main();
