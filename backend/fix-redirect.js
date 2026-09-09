
const { prisma } = require('/root/shipin-cinematic-studio/backend/src/utils/index.js');
async function main() {
  await prisma.$executeRawUnsafe("UPDATE route_config SET value = jsonb_set(value::jsonb, '{qqRedirectUri}', '"kunlun://auth/qq/callback"') WHERE scope = 'tea' AND key = 'config'");
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
  console.log('Updated qqRedirectUri:', row?.value?.qqRedirectUri);
  await prisma.$disconnect();
}
main();
