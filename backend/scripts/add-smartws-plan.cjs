// 新增「智慧车间专属会员」套餐（幂等）：MemberPlan + SubscriptionPlan 目录商品
// 666 元/月，开通即享线上全部 VIP 权限（含昆仑工坊 + 智慧车间）
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const CAPABILITIES = JSON.stringify([
  'VIP_BASIC', 'VIP_YEAR', 'VIP_DIRECTOR', 'VIP_SMARTWS',
  'MEMBER_STORAGE_10GB', 'DAILY_QUOTA_UNLIMITED', 'MAX_RESOLUTION_4K',
  'NO_WATERMARK', 'AUDIO_LONG', 'ONLINE_API', 'LOCAL_MODEL',
]);

async function main() {
  // 1) MemberPlan（权益参数拉满）
  const plan = await p.memberPlan.upsert({
    where: { level: 'smartws' },
    update: {
      name: '智慧车间专属会员', price: 666, months: 1,
      storageLimit: 10240, dailyQuota: 999, maxResolution: '4k',
      maxDuration: 120, concurrentTasks: 8, watermark: false,
      apiAccess: true, enabled: true, icon: '🧠', color: '#22d3ee',
      onlineApiEnabled: true, localModelEnabled: true, sortOrder: 99,
    },
    create: {
      level: 'smartws', name: '智慧车间专属会员', price: 666, months: 1,
      dayPrice: 0, renewable: true, firstPurchaseOnly: false,
      storageLimit: 10240, dailyQuota: 999, maxResolution: '4k',
      maxDuration: 120, concurrentTasks: 8, watermark: false,
      apiAccess: true, sortOrder: 99, enabled: true, icon: '🧠', color: '#22d3ee',
      onlineApiEnabled: true, localModelEnabled: true,
    },
  });
  console.log('[1] MemberPlan smartws:', plan.id.slice(0, 8), plan.name, '¥' + plan.price + '/月');

  // 2) SubscriptionPlan（商品目录 SSOT，价格/周期权威）
  const prod = await p.subscriptionPlan.upsert({
    where: { code: 'vip_smartws' },
    update: {
      name: '智慧车间专属会员',
      description: '开通即享线上全部 VIP 权限（含昆仑工坊 + 智慧车间），本地版智慧车间全功能解锁',
      price: 666, currency: 'CNY', billingCycle: 'monthly',
      capabilities: CAPABILITIES, status: 'active',
    },
    create: {
      code: 'vip_smartws', name: '智慧车间专属会员',
      description: '开通即享线上全部 VIP 权限（含昆仑工坊 + 智慧车间），本地版智慧车间全功能解锁',
      price: 666, currency: 'CNY', billingCycle: 'monthly',
      capabilities: CAPABILITIES, status: 'active',
    },
  });
  console.log('[2] SubscriptionPlan vip_smartws:', prod.id.slice(0, 8), '¥' + prod.price + '/月 status=' + prod.status);

  await p.$disconnect();
  console.log('✅ 智慧车间专属会员套餐已就绪');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
