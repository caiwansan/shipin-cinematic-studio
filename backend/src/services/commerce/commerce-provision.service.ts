/**
 * services/commerce/commerce-provision.service.ts — SPRINT-COMMERCE-UNIFICATION-CAREER-01 / COMMERCE-SSOT-02
 *
 * 昆仑镜统一 Provision 服务（Commerce Authority 唯一激活入口）
 *
 * 架构（掌柜冻结）：
 *   PaymentSuccess
 *     → Commerce Event（Order 已支付）
 *     → Entitlement Grant（个人 PersonalEntitlement / 企业 EnterpriseEntitlement）
 *     → AgentProvisionService（统一部署 AI 员工实例）
 *
 * 禁止：业务线自建激活函数（原 payment.ts handleCareerSubscriptionFromPayment 已废除）
 * 禁止：业务线自建商业表（career_order / career_payment / career_subscription）
 * 禁止：业务线专属 checkout（/payment/{workspace}/checkout）
 *
 * 商品目录 = SubscriptionPlan（Product + CapabilityBundle 合一，SSOT）
 *   商品自描述（metadata JSON，代码零分支）：
 *     {
 *       productType: 'AI_AGENT' | 'VIP' | 'ORGANIZATION',
 *       provision: 'agent' | 'entitlement_only',
 *       months: 30,            // 订阅周期（天）
 *       memberPlanLevel: null, // VIP 商品 → 兼容层同步的 user.memberTier 值（basic/vips/director/pro）
 *       coins: 0               // 赠送积分（VIP 兼容层）
 *     }
 */
import { PrismaClient } from '@prisma/client'
import { CareerAgentService } from '../enterprise/workflow/career-agent.service.js'

const prisma = new PrismaClient()

/** 解析商品元数据（Product Catalog 自描述，禁止代码硬编码商品分支） */
export function resolveProductMeta(plan: { metadata?: string | null }): {
  productType: string
  provision: 'agent' | 'entitlement_only'
  months: number
  memberPlanLevel: string | null
  coins: number
} {
  let md: Record<string, any> = {}
  try { md = JSON.parse(plan.metadata || '{}') } catch {}
  const productType = md.productType || 'GENERIC'
  const provision = md.provision === 'agent' ? 'agent' : 'entitlement_only'
  const months = Number(md.months) || 30
  const memberPlanLevel = md.memberPlanLevel ? String(md.memberPlanLevel) : null
  const coins = Number(md.coins) || 0
  return { productType, provision, months, memberPlanLevel, coins }
}

export async function getProductByCode(productCode: string) {
  return prisma.subscriptionPlan.findUnique({ where: { code: productCode } })
}

function calcEndDate(start: Date, months: number): Date {
  return new Date(start.getTime() + Math.max(1, months) * 24 * 60 * 60 * 1000)
}

/**
 * 顺延到期时间（掌柜指令 2026-08-05：重复付款必须延长 VIP 时限，禁止重置吃剩余时间）
 * 有效期内续费 → 从原到期日顺延；已过期/无到期日 → 从当前时间起算
 */
function extendEndDate(current: Date | null | undefined, start: Date, months: number): Date {
  const base = current && current.getTime() > start.getTime() ? current : start
  return new Date(base.getTime() + Math.max(1, months) * 24 * 60 * 60 * 1000)
}

/**
 * 统一支付成功 Provision 入口
 * 所有支付成功来源（验签回调 / 管理员确认 / 代金券免支付）必须走这里，禁止旁路激活
 */
export async function provisionFromPayment(payOrder: {
  id: string
  userId: string
  orderNo: string
  amount: number
  planType?: string | null
  metadata?: any
  status?: string
}, tradeNo: string, payTime: Date) {
  const productCode = payOrder.planType
  if (!productCode) {
    console.error(`[commerce-provision] 订单 ${payOrder.orderNo} 缺少 planType（productCode），跳过 Provision`)
    return { provisioned: false, reason: 'missing_product_code' }
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: productCode } })
  if (!plan) {
    console.error(`[commerce-provision] 未知商品 ${productCode}（订单 ${payOrder.orderNo}），跳过 Provision`)
    return { provisioned: false, reason: 'unknown_product' }
  }

  const productMeta = resolveProductMeta(plan)
  console.log(`[commerce-provision] 订单 ${payOrder.orderNo} → 商品 ${productCode} (${productMeta.productType}/${productMeta.provision}) 开始 Provision`)

  const userId = payOrder.userId
  const now = new Date()

  // ─── Step 1: 订阅落库（统一 Subscription，个人线 tenantId = userId） ───
  // 1a. 个人 Tenant（Commerce Authority 租户锚点）
  let tenant = await prisma.tenant.findUnique({ where: { id: userId } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { id: userId, name: `Personal: ${userId.slice(0, 8)}`, type: 'personal', status: 'active' },
    })
  }

  // 1b. 订阅：active 跳过；过期/取消 → 续期
  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: userId, planId: plan.id },
    orderBy: { createdAt: 'desc' },
  })

  let sub: any
  if (existingSub) {
    if (existingSub.status === 'active') {
      // 有效期内重复购买：顺延 endDate，不重置（幂等锚点 + 顺延语义）
      const endDate = extendEndDate(existingSub.endDate, now, productMeta.months)
      sub = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          endDate,
          metadata: mergeMetadata(existingSub.metadata, { lastExtendedAt: now.toISOString() }),
        },
      })
      console.log(`[commerce-provision] 订阅顺延: userId=${userId.slice(0, 8)}, endDate=${endDate.toISOString()}`)
    } else {
      sub = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          status: 'active',
          startDate: now,
          endDate: extendEndDate(existingSub.endDate, now, productMeta.months),
          metadata: mergeMetadata(existingSub.metadata, { provisioningStatus: 'pending', provisioningUpdatedAt: now.toISOString() }),
        },
      })
      console.log(`[commerce-provision] 续期成功: userId=${userId.slice(0, 8)}`)
    }
  } else {
    sub = await prisma.subscription.create({
      data: {
        tenantId: userId,
        planId: plan.id,
        status: 'active',
        startDate: now,
        endDate: calcEndDate(now, productMeta.months),
        autoRenew: false,
        metadata: JSON.stringify({
          source: 'payment',
          orderNo: payOrder.orderNo,
          tradeNo,
          amount: payOrder.amount,
          paidAt: payTime.toISOString(),
          provisioningStatus: 'pending',
          provisioningUpdatedAt: now.toISOString(),
        }),
      },
    })
    console.log(`[commerce-provision] 新订阅创建: userId=${userId.slice(0, 8)}, subId=${sub.id.slice(0, 8)}`)
  }

  // ─── Step 2: Entitlement Grant（统一权益授予） ───
  // 2a. 套餐能力目录（CapabilityBundle）：plan.capabilities JSON
  let capabilityCodes: string[] = []
  try {
    const caps = JSON.parse(plan.capabilities || '[]')
    capabilityCodes = Array.isArray(caps) ? caps : []
  } catch { capabilityCodes = [] }

  // 2b. 个人权益授予（PersonalEntitlement，幂等：同 subscription 同 planCode 更新）
  const existingEnt = await prisma.personalEntitlement.findFirst({
    where: { userId, subscriptionId: sub.id, planCode: productCode },
  })
  let entitlement: any
  // 权益到期：有效期内续费 → 从原到期日顺延；否则从当前时间起算（掌柜 2026-08-05：重复付款延长时限）
  const effectiveUntil = extendEndDate(existingEnt?.effectiveUntil, now, productMeta.months)
  if (existingEnt) {
    entitlement = await prisma.personalEntitlement.update({
      where: { id: existingEnt.id },
      data: {
        status: 'active',
        capabilityCodes: capabilityCodes as any,
        effectiveFrom: now,
        effectiveUntil,
        source: 'payment',
        orderNo: payOrder.orderNo,
      },
    })
    console.log(`[commerce-provision] 权益已续期: userId=${userId.slice(0, 8)}, entId=${entitlement.id.slice(0, 8)}`)
  } else {
    entitlement = await prisma.personalEntitlement.create({
      data: {
        userId,
        subscriptionId: sub.id,
        planCode: productCode,
        productType: productMeta.productType,
        capabilityCodes: capabilityCodes as any,
        status: 'active',
        effectiveFrom: now,
        effectiveUntil,
        source: 'payment',
        orderNo: payOrder.orderNo,
      },
    })
    console.log(`[commerce-provision] 权益已授予: userId=${userId.slice(0, 8)}, entId=${entitlement.id.slice(0, 8)}, capabilities=${capabilityCodes.length}`)
  }

  // ─── Step 3: Provision 动作（agent 部署 / entitlement_only 权益类） ───
  await setSubProvisioningStatus(sub.id, 'provisioning')

  if (productMeta.provision === 'agent') {
    try {
      const agentService = new CareerAgentService(prisma)
      const hasAgent = await agentService.hasCareerAgent(userId)
      if (!hasAgent) {
        const newAgent = await agentService.createAndDeploy({ userId })
        if (newAgent && newAgent.status === 'active') {
          await setSubProvisioningStatus(sub.id, 'active', {
            provisionedAt: new Date().toISOString(),
            profileId: newAgent.profileId,
            entitlementId: entitlement.id,
          })
          console.log(`[commerce-provision] Agent 已部署: userId=${userId.slice(0, 8)}, profileId=${newAgent.profileId.slice(0, 8)}`)
        } else {
          throw new Error(`createAndDeploy 返回非 active 状态: ${newAgent?.status || 'null'}`)
        }
      } else {
        await setSubProvisioningStatus(sub.id, 'active', { provisionedVia: 'pre_existing', entitlementId: entitlement.id })
        console.log(`[commerce-provision] Agent 已存在，跳过部署: userId=${userId.slice(0, 8)}`)
      }
    } catch (agentErr: any) {
      const errMsg = agentErr.message || '未知错误'
      console.error(`[commerce-provision] Agent 部署失败: userId=${userId.slice(0, 8)}, error=${errMsg}`)
      await setSubProvisioningStatus(sub.id, 'failed', {
        provisioningError: errMsg,
        provisioningFailedAt: new Date().toISOString(),
      })
      return { provisioned: false, reason: 'agent_provision_failed', error: errMsg, entitlementId: entitlement.id }
    }
  } else {
    // 纯权益类商品（VIP / 未来增值包）：无需部署 Agent
    await setSubProvisioningStatus(sub.id, 'active', { provisionedVia: 'entitlement_only', entitlementId: entitlement.id })

    // VIP 兼容层：同步 user.memberTier / membership / coinLog（存量判定链依赖，Entitlement 为权威）
    if (productMeta.productType === 'VIP' && productMeta.memberPlanLevel) {
      const tier = productMeta.memberPlanLevel
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user) {
        await prisma.user.update({
          where: { id: userId },
          data: { memberTier: tier, memberExpiresAt: effectiveUntil },
        })
        await prisma.membership.upsert({
          where: { userId },
          update: { tier, expiresAt: effectiveUntil },
          create: { userId, tier, expiresAt: effectiveUntil, credits: 0 },
        })
        if (productMeta.coins > 0) {
          await prisma.coinLog.create({
            data: { userId, amount: productMeta.coins, type: 'recharge', remark: `会员商品「${plan.name}」赠送`, relatedId: payOrder.id },
          })
        }
        console.log(`[commerce-provision] VIP 兼容层同步: userId=${userId.slice(0, 8)}, tier=${tier}`)
      }
    }
  }

  return { provisioned: true, subscriptionId: sub.id, entitlementId: entitlement.id, planCode: productCode }
}

/** 查询个人当前有效权益（Entitlement 权威：Subscription active + PersonalEntitlement active + 未过期） */
export async function getPersonalEntitlement(userId: string, planCode: string) {
  const entitlement = await prisma.personalEntitlement.findFirst({
    where: { userId, planCode, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  if (!entitlement) return null
  // 校验订阅仍 active（权益生命周期跟随订阅）
  const sub = await prisma.subscription.findUnique({ where: { id: entitlement.subscriptionId } })
  if (!sub || sub.status !== 'active') return null
  // 校验未过期
  if (entitlement.effectiveUntil && entitlement.effectiveUntil < new Date()) return null
  return entitlement
}

/** 查询用户所有有效个人权益（VIP / AI 员工） */
export async function getActiveEntitlements(userId: string) {
  const ents = await prisma.personalEntitlement.findMany({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  const now = new Date()
  const valid: typeof ents = []
  for (const ent of ents) {
    if (ent.effectiveUntil && ent.effectiveUntil < now) continue
    const sub = await prisma.subscription.findUnique({ where: { id: ent.subscriptionId } })
    if (sub && sub.status === 'active') valid.push(ent)
  }
  return valid
}

/** 当前有效 VIP 权益（判定链权威：Entitlement → membership/memberTier 兼容） */
export async function getActiveVipEntitlement(userId: string) {
  const ents = await getActiveEntitlements(userId)
  return ents.find(e => e.productType === 'VIP') || null
}

async function setSubProvisioningStatus(subId: string, status: string, extra: Record<string, any> = {}) {
  const sub = await prisma.subscription.findUnique({ where: { id: subId } })
  const md = safeParse(sub?.metadata)
  await prisma.subscription.update({
    where: { id: subId },
    data: {
      metadata: JSON.stringify({ ...md, provisioningStatus: status, ...extra }),
    },
  })
}

function safeParse(json?: string | null): Record<string, any> {
  if (!json) return {}
  try { return typeof json === 'string' ? JSON.parse(json) : json } catch { return {} }
}

function mergeMetadata(existing: string | null, patch: Record<string, any>): string {
  const base = safeParse(existing)
  return JSON.stringify({ ...base, ...patch })
}
