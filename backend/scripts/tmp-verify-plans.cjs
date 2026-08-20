// 验证：模拟 /api/member/plans 合并逻辑，确认 smartws 出现在套餐列表
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const plans = await p.memberPlan.findMany({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } });
  const vipProducts = await p.subscriptionPlan.findMany({ where: { code: { startsWith: 'vip_' }, status: 'active' } });
  const merged = plans.map((pl) => {
    const prod = vipProducts.find((v) => v.code === 'vip_' + pl.level);
    return { level: pl.level, name: pl.name, price: prod?.price ?? pl.price, cycle: prod?.billingCycle || 'monthly', productCode: prod?.code || null, capabilities: (() => { try { return JSON.parse(prod?.capabilities || '[]').length } catch { return 0 } })() };
  });
  console.log(JSON.stringify(merged, null, 1));
  await p.$disconnect();
}
main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
