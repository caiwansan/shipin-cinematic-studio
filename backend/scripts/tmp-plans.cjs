const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const ps = await p.memberPlan.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log(JSON.stringify(ps.map(x => ({ level: x.level, name: x.name, price: x.price, enabled: x.enabled, sortOrder: x.sortOrder, renewable: x.renewable })), null, 1));
  await p.$disconnect();
})();
