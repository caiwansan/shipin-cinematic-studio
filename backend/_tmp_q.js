
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.routeConfig.findMany({
    where: { OR: [{ key: { contains: 'tea' } }, { key: { contains: 'config' } }, { key: { contains: 'version' } }] },
    select: { id: true, scope: true, key: true, value: true, isActive: true },
  });
  console.log(JSON.stringify(rows, null, 2));
  // also list distinct scopes
  const scopes = await prisma.$queryRawUnsafe('SELECT DISTINCT scope FROM route_config ORDER BY scope');
  console.log('SCOPES:', JSON.stringify(scopes));
  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERR', e.message); await prisma.$disconnect(); process.exit(1); });

