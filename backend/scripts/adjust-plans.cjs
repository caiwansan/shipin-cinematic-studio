// 后端套餐体系调整：director 下架 + sortOrder 排位（basic < local_vip < vips < smartws）
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  // 1) sortOrder 排位重设
  const order = { basic: 10, local_vip: 20, vips: 30, smartws: 99 };
  for (const [level, so] of Object.entries(order)) {
    await p.memberPlan.updateMany({ where: { level }, data: { sortOrder: so } });
  }
  // 2) director 暂时下架（MemberPlan + SubscriptionPlan 目录商品）
  await p.memberPlan.updateMany({ where: { level: 'director' }, data: { enabled: false } });
  await p.subscriptionPlan.updateMany({ where: { code: 'vip_director' }, data: { status: 'inactive' } });
  // 3) 验证
  const plans = await p.memberPlan.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('套餐现状:');
  for (const pl of plans) {
    console.log(`  ${pl.level} ${pl.name} ¥${pl.price} sortOrder=${pl.sortOrder} enabled=${pl.enabled}`);
  }
  const prods = await p.subscriptionPlan.findMany({ where: { code: { startsWith: 'vip_' } }, select: { code: true, status: true } });
  console.log('商品目录:', prods.map(x => x.code + '=' + x.status).join(', '));
  await p.$disconnect();
  console.log('✅ 套餐体系调整完成');
}
main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
