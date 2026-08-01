/**
 * services/commerce/commerce-provision.service.ts — SPRINT-COMMERCE-UNIFICATION-CAREER-01
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
 *
 * 商品目录 = SubscriptionPlan（Product + CapabilityBundle 合一）
 *   productCode = plan.code（career_agent | vip_basic | ...）
 *   productType 映射：AI_AGENT（部署员工实例）/ VIP（权益授予）
 */
import { PrismaClient } from '@prisma/client'
import { CareerAgentService } from '../enterprise/workflow/career-agent.service.js'

const prisma = new PrismaClient()

/** Product 类型 → 预配置动作 */
export const PRODUCT_TYPES: Record<string, { productType: string; provision: 'agent' | 'entitlement_only' }> = {
  career_agent: { productType: 'AI_AGENT', provision: 'agent' },
  // 未来：vip_basic / vip_advanced → { productType: 'VIP', provision: 'entitlement_only' }
}

export async function getProductByCode(productCode: string) {
  return prisma.subscriptionPlan.findUnique({ where: { code: productCode } })
}

/**
 * 统一支付成功 Provision 入口
 * 所有支付成功来源（验签回调 / 管理员确认）必须走这里，禁止旁路激活
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

  const productMeta = PRODUCT_TYPES[productCode]
  if (!productMeta) {
    console.error(`[commerce-provision] 未知商品 ${productCode}（订单 ${payOrder.orderNo}），跳过 Provision`)
    return { provisioned: false, reason: 'unknown_product' }
  }

  console.log(`[commerce-provision] 订单 ${payOrder.orderNo} → 商品 ${productCode} (${productMeta.productType}) 开始 Provision`)

  // ─── Step 1: 订阅落库（统一 Subscription，个人线 tenantId = userId） ───
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: productCode } })
  if (!plan) {
    console.error(`[commerce-provision] 套餐 ${productCode} 未配置`)
    return { provisioned: false, reason: 'plan_not_configured' }
  }

  const userId = payOrder.userId
  const now = new Date()

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
      console.log(`[commerce-provision] 订阅已激活，跳过: userId=${userId.slice(0, 8)}`)
      sub = existingSub
    } else {
      sub = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          status: 'active',
          startDate: now,
          endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
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
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
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
  if (existingEnt) {
    entitlement = await prisma.personalEntitlement.update({
      where: { id: existingEnt.id },
      data: {
        status: 'active',
        capabilityCodes: capabilityCodes as any,
        effectiveFrom: now,
        effectiveUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
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
        effectiveUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        source: 'payment',
        orderNo: payOrder.orderNo,
      },
    })
    console.log(`[commerce-provision] 权益已授予: userId=${userId.slice(0, 8)}, entId=${entitlement.id.slice(0, 8)}, capabilities=${capabilityCodes.length}`)
  }

  // ─── Step 3: Agent Provision（统一部署） ───
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
    // 纯权益类商品（未来 VIP）：无需部署 Agent
    await setSubProvisioningStatus(sub.id, 'active', { provisionedVia: 'entitlement_only', entitlementId: entitlement.id })
  }

  return { provisioned: true, subscriptionId: sub.id, entitlementId: entitlement.id, planCode: productCode }
}

/** 查询个人当前有效权益（Entitlement 权威：Subscription active + PersonalEntitlement active） */
export async function getPersonalEntitlement(userId: string, planCode: string) {
  const entitlement = await prisma.personalEntitlement.findFirst({
    where: { userId, planCode, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  if (!entitlement) return null
  // 校验订阅仍 active（权益生命周期跟随订阅）
  const sub = await prisma.subscription.findUnique({ where: { id: entitlement.subscriptionId } })
  if (!sub || sub.status !== 'active') return null
  return entitlement
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
