/**
 * 一次性迁移脚本：SPRINT-COMMERCE-SSOT-02 T02 VIP 商品注册
 *
 * 1. career_agent 补 metadata（productType/provision/months 商品自描述）
 * 2. 注册 VIP 商品到 SubscriptionPlan（Product Catalog SSOT）：
 *    - vip_basic   基础会员 ¥9.9 / monthly   （MemberPlan.basic）
 *    - vip_vips    年卡会员 ¥1399 / yearly   （MemberPlan.vips）
 *    - vip_director 高级会员 ¥139 / monthly  （MemberPlan.director）
 *    - vip_pro     历史档位（不再售卖，仅存量迁移兼容）
 * 3. 存量 VIP 用户迁移：user.memberTier != free → Subscription + PersonalEntitlement(source=migration)
 *
 * 幂等：可重复执行
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const VIP_PRODUCTS = [
  { code: 'vip_basic', name: '基础会员', description: '基础会员权益', price: 9.9, currency: 'CNY', billingCycle: 'monthly', months: 30, memberPlanLevel: 'basic', coins: 0, caps: ['VIP_BASIC', 'MEMBER_STORAGE_500MB', 'DAILY_QUOTA_5', 'MAX_RESOLUTION_720P', 'NO_WATERMARK', 'AUDIO_120S'] },
  { code: 'vip_vips', name: '年卡会员', description: '年卡会员权益', price: 1399, currency: 'CNY', billingCycle: 'yearly', months: 365, memberPlanLevel: 'vips', coins: 0, caps: ['VIP_YEAR', 'MEMBER_STORAGE_500MB', 'DAILY_QUOTA_5', 'MAX_RESOLUTION_720P', 'NO_WATERMARK', 'AUDIO_120S'] },
  { code: 'vip_director', name: '高级会员', description: '高级会员权益', price: 139, currency: 'CNY', billingCycle: 'monthly', months: 30, memberPlanLevel: 'director', coins: 0, caps: ['VIP_DIRECTOR', 'MEMBER_STORAGE_500MB', 'DAILY_QUOTA_5', 'MAX_RESOLUTION_720P', 'NO_WATERMARK', 'AUDIO_120S'] },
  { code: 'vip_pro', name: 'Pro 会员（历史）', description: '历史档位，仅存量迁移兼容，不再售卖', price: null, currency: 'CNY', billingCycle: 'monthly', months: 30, memberPlanLevel: 'pro', coins: 0, caps: ['VIP_PRO', 'MEMBER_STORAGE_500MB', 'DAILY_QUOTA_5', 'MAX_RESOLUTION_720P', 'NO_WATERMARK', 'AUDIO_120S'] },
];

async function main() {
  // ── 1. career_agent 补 metadata（商品自描述） ──
  const career = await p.subscriptionPlan.findUnique({ where: { code: 'career_agent' } });
  if (career) {
    await p.subscriptionPlan.update({
      where: { id: career.id },
      data: { metadata: JSON.stringify({ productType: 'AI_AGENT', provision: 'agent', months: 30, memberPlanLevel: null, coins: 0 }) },
    });
    console.log('[1] career_agent metadata 补齐');
  }

  // ── 2. 注册 VIP 商品（幂等 upsert） ──
  for (const prod of VIP_PRODUCTS) {
    const existing = await p.subscriptionPlan.findUnique({ where: { code: prod.code } });
    const data = {
      name: prod.name,
      description: prod.description,
      price: prod.price,
      currency: prod.currency,
      billingCycle: prod.billingCycle,
      capabilities: JSON.stringify(prod.caps),
      metadata: JSON.stringify({ productType: 'VIP', provision: 'entitlement_only', months: prod.months, memberPlanLevel: prod.memberPlanLevel, coins: prod.coins }),
      status: 'active',
    };
    if (existing) {
      await p.subscriptionPlan.update({ where: { id: existing.id }, data });
      console.log(`[2] ${prod.code} 已更新`);
    } else {
      await p.subscriptionPlan.create({ data: { code: prod.code, ...data } });
      console.log(`[2] ${prod.code} 已注册`);
    }
  }

  // ── 3. 存量 VIP 用户迁移 → Subscription + PersonalEntitlement(source=migration) ──
  const allUsers = await p.user.findMany({
    select: { id: true, memberTier: true, memberExpiresAt: true },
  });
  const paidUsers = allUsers.filter(u => u.memberTier && !['free', 'enterprise'].includes(u.memberTier));
  console.log(`[3] 存量付费用户 ${paidUsers.length} 个`);
  let migrated = 0, skipped = 0;
  for (const u of paidUsers) {
    const planCode = `vip_${u.memberTier}`;
    const plan = await p.subscriptionPlan.findUnique({ where: { code: planCode } });
    if (!plan) { console.log(`[3] 跳过 ${u.memberTier}（无商品 ${planCode}）`); skipped++; continue; }
    const now = new Date();
    const valid = u.memberExpiresAt && u.memberExpiresAt > now;
    // 确保个人 Tenant 存在（Commerce Authority 租户锚点）
    let tenant = await p.tenant.findUnique({ where: { id: u.id } });
    if (!tenant) {
      tenant = await p.tenant.create({ data: { id: u.id, name: `Personal: ${u.id.slice(0, 8)}`, type: 'personal', status: 'active' } });
    }
    // 迁移订阅（保留历史权益状态）
    const existingSub = await p.subscription.findFirst({ where: { tenantId: u.id, planId: plan.id } });
    let sub = existingSub;
    if (!sub) {
      sub = await p.subscription.create({
        data: {
          tenantId: u.id,
          planId: plan.id,
          status: valid ? 'active' : 'expired',
          startDate: now,
          endDate: u.memberExpiresAt || new Date(now.getTime() + 30 * 24 * 3600 * 1000),
          autoRenew: false,
          metadata: JSON.stringify({ source: 'migration', note: 'SPRINT-COMMERCE-SSOT-02 存量 VIP 迁移', provisioningStatus: valid ? 'active' : 'expired' }),
        },
      });
    }
    const ent = await p.personalEntitlement.findFirst({ where: { userId: u.id, planCode } });
    if (ent) { skipped++; continue; }
    await p.personalEntitlement.create({
      data: {
        userId: u.id,
        subscriptionId: sub.id,
        planCode,
        productType: 'VIP',
        capabilityCodes: JSON.parse(plan.capabilities || '[]'),
        status: valid ? 'active' : 'expired',
        effectiveFrom: now,
        effectiveUntil: u.memberExpiresAt || null,
        source: 'migration',
      },
    });
    migrated++;
    console.log(`[3] ${u.id.slice(0,8)} tier=${u.memberTier} → ${planCode} (${valid ? 'active' : 'expired'})`);
  }
  console.log(`[3] 完成：迁移 ${migrated}，跳过 ${skipped}`);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
