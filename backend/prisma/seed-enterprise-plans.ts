/**
 * prisma/seed-enterprise-plans.ts — Enterprise Recruitment 默认套餐 Seed
 *
 * 职责：创建三个默认 EnterprisePlan（Trial / Professional / Enterprise）
 * 数据源唯一：EnterprisePlan
 * 金额单位：分（不使用浮点）
 *
 * 运行方式：npx prisma db seed -- --seed enterprise-plans
 * 或：npx ts-node prisma/seed-enterprise-plans.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface PlanSeed {
  name: string
  displayName: string
  description: string
  price: number // 月付价格（分）
  yearlyPrice: number // 年付价格（分）
  originalPrice: number // 原价（分）
  maxEmployees: number // AI员工上限
  maxChannels: number // 渠道上限
  maxMembers: number // 企业成员上限
  storageLimit: number // 存储上限（GB）
  sortOrder: number
  features: string[]
}

const DEFAULT_PLANS: PlanSeed[] = [
  {
    name: 'trial',
    displayName: '试用版',
    description: '适合个人体验，包含 1 个 AI 员工和 3 个成员名额',
    price: 0, // 0 分 = 免费
    yearlyPrice: 0,
    originalPrice: 0,
    maxEmployees: 1,
    maxChannels: 1,
    maxMembers: 3,
    storageLimit: 1,
    sortOrder: 0,
    features: ['1个AI员工', '3个成员', '1GB存储', '基础支持'],
  },
  {
    name: 'professional',
    displayName: '专业版',
    description: '适合中小团队，包含 3 个 AI 员工和 10 个成员名额',
    price: 29900, // 299 元/月
    yearlyPrice: 299000, // 2990 元/年
    originalPrice: 39900, // 原价 399 元/月
    maxEmployees: 3,
    maxChannels: 3,
    maxMembers: 10,
    storageLimit: 10,
    sortOrder: 1,
    features: ['3个AI员工', '10个成员', '10GB存储', '3个渠道', '优先支持', '高级分析'],
  },
  {
    name: 'enterprise',
    displayName: '企业版',
    description: '适合大型组织，包含 10 个 AI 员工和 50 个成员名额',
    price: 299900, // 2999 元/月
    yearlyPrice: 2999000, // 29990 元/年
    originalPrice: 399900, // 原价 3999 元/月
    maxEmployees: 10,
    maxChannels: 10,
    maxMembers: 50,
    storageLimit: 100,
    sortOrder: 2,
    features: ['10个AI员工', '50个成员', '100GB存储', '10个渠道', '专属客户经理', '高级分析', '自定义集成', 'SLA保障'],
  },
]

async function seedEnterprisePlans() {
  console.log('🌱 Seeding Enterprise Plans...')

  for (const plan of DEFAULT_PLANS) {
    const existing = await prisma.enterprisePlan.findUnique({
      where: { name: plan.name },
    })

    if (existing) {
      console.log(`  ⚠️  Plan "${plan.name}" already exists (id: ${existing.id}), updating...`)
      await prisma.enterprisePlan.update({
        where: { id: existing.id },
        data: {
          displayName: plan.displayName,
          description: plan.description,
          price: plan.price,
          yearlyPrice: plan.yearlyPrice,
          originalPrice: plan.originalPrice,
          maxEmployees: plan.maxEmployees,
          maxChannels: plan.maxChannels,
          maxMembers: plan.maxMembers,
          storageLimit: plan.storageLimit,
          sortOrder: plan.sortOrder,
          features: plan.features,
          enabled: true,
        },
      })
      console.log(`  ✅ Updated: ${plan.displayName} (${plan.name})`)
    } else {
      const created = await prisma.enterprisePlan.create({
        data: {
          name: plan.name,
          displayName: plan.displayName,
          description: plan.description,
          price: plan.price,
          yearlyPrice: plan.yearlyPrice,
          originalPrice: plan.originalPrice,
          currency: 'CNY',
          billingCycle: 'monthly',
          maxEmployees: plan.maxEmployees,
          maxChannels: plan.maxChannels,
          maxMembers: plan.maxMembers,
          storageLimit: plan.storageLimit,
          requireOwnLLMKey: false,
          allowedProviders: ['deepseek', 'openai', 'claude', 'zhipu'],
          quotaPolicy: 'unlimited',
          features: plan.features,
          enabled: true,
          sortOrder: plan.sortOrder,
        },
      })
      console.log(`  ✅ Created: ${plan.displayName} (${plan.name}) — id: ${created.id}`)
    }
  }

  console.log('\n📊 Seed Summary:')
  const allPlans = await prisma.enterprisePlan.findMany({
    orderBy: { sortOrder: 'asc' },
  })
  for (const plan of allPlans) {
    console.log(`  • ${plan.displayName} (${plan.name}): ¥${(plan.price / 100).toFixed(0)}/月, maxEmployees=${plan.maxEmployees}, maxMembers=${plan.maxMembers}`)
  }

  console.log('\n✅ Enterprise Plans seed complete.')
}

seedEnterprisePlans()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
