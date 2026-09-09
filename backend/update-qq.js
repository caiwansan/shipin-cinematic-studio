
const { prisma } = require('/root/shipin-cinematic-studio/backend/src/utils/index.js');
async function main() {
  try {
    const existing = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
    if (existing) {
      const v = existing.value || {};
      v.qqAppId = '1905458744';
      v.qqAppSecret = 'gJkz2tXzEH7kBPQS';
      v.qqRedirectUri = 'kunlun://auth/qq/callback';
      await prisma.routeConfig.update({ where: { id: existing.id }, data: { value: v } });
      console.log('Updated: redirectUri -> kunlun://auth/qq/callback');
    } else {
      console.log('No existing record, creating...');
      await prisma.routeConfig.create({ data: { scope: 'tea', key: 'config', value: { qqAppId: '1905458744', qqAppSecret: 'gJkz2tXzEH7kBPQS', qqRedirectUri: 'kunlun://auth/qq/callback' } } });
      console.log('Created with redirectUri: kunlun://auth/qq/callback');
    }
  } catch(e) { console.error('Error:', e.message); }
  await prisma.$disconnect();
}
main();
