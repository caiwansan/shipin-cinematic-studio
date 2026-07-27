/**
 * capability-seed.ts — 招聘套餐与 Capability 种子数据
 * 
 * 规范来源：P1-Capability-Model-v1.0（FROZEN）
 * 
 * 执行方式：npx tsx src/seeds/capability-seed.ts
 * 幂等设计：可重复执行，已存在则跳过
 */

import { PrismaClient } from '@prisma/client';
import { PLAN_CAPABILITY_MATRIX, PLAN_METADATA } from '../constants/capabilities.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] 开始写入招聘套餐数据...\n');

  for (const [planCode, capabilities] of Object.entries(PLAN_CAPABILITY_MATRIX)) {
    const meta = PLAN_METADATA[planCode];
    if (!meta) {
      console.warn(`[Seed] 跳过 ${planCode}：无元数据定义`);
      continue;
    }

    // 1. Upsert SubscriptionPlan
    const plan = await prisma.subscriptionPlan.upsert({
      where: { code: planCode },
      update: {
        name: meta.name,
        description: meta.description,
        capabilities: JSON.stringify(capabilities),
      },
      create: {
        code: planCode,
        name: meta.name,
        description: meta.description,
        price: null, // 价格留待后续冻结
        currency: 'CNY',
        billingCycle: 'monthly',
        capabilities: JSON.stringify(capabilities),
        status: 'active',
      },
    });
    console.log(`[Seed] ✅ SubscriptionPlan: ${planCode} (${meta.name}) [id: ${plan.id}]`);

    // 2. 同步 CapabilityGrant
    //   先删除旧的 grants，再重新创建（保持与矩阵一致）
    await prisma.capabilityGrant.deleteMany({
      where: { planId: plan.id },
    });

    for (const capability of capabilities) {
      await prisma.capabilityGrant.create({
        data: {
          planId: plan.id,
          capability,
          limits: null, // 第一版不限制，后续 Domain Review 配置
        },
      });
    }
    console.log(`[Seed]   同步 ${capabilities.length} 个 CapabilityGrant`);
  }

  // 3. 统计
  const planCount = await prisma.subscriptionPlan.count();
  const grantCount = await prisma.capabilityGrant.count();
  console.log(`\n[Seed] 完成！SubscriptionPlan: ${planCount} 条，CapabilityGrant: ${grantCount} 条`);
}

main()
  .catch((err) => {
    console.error('[Seed] ❌ 失败:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
