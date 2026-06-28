const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const agents = await prisma.marketAgent.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
  console.log('=== 代理商列表 ===');
  for (const a of agents) {
    const t = a.createdAt.toISOString().replace('T',' ').slice(0,19);
    console.log(a.id.slice(0,8), '|', a.name, '| userId=', a.userId, '| level=', a.level, '|', t);
  }
  const total = await prisma.marketAgent.count();
  const withUser = await prisma.marketAgent.count({ where: { userId: { not: null } } });
  console.log('\n总计:', total, '个，有关联会员:', withUser, '个');
  await prisma.$disconnect();
}
main().catch(console.error);
