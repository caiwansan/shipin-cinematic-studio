/**
 * BETA-08.1: Enterprise Entitlement Service
 * 
 * 职责：权益是连接 Subscription 与 Agent Instance 的中间层
 * - Plan 定义"卖什么"
 * - Subscription 定义"买了什么"
 * - Entitlement 定义"当前能用什么"（实时权益）
 * - Agent Instance 是"权益兑现后的运行实例"
 */

import { prisma } from '../../utils/index.js'

// Sprint-14 Task 04K Step 2: 兼容解析 capabilityCodes
// 旧格式: ["resume_analysis", "candidate_scoring"]
// 新格式: { employees: [{ role, displayName }], capabilities: ["..."] }
function parseCapabilityCodes(raw: unknown): { employees: Array<{ role: string; displayName: string }>; capabilities: string[] } {
  if (!raw) {
    return { employees: [], capabilities: [] }
  }

  // 新格式: 对象
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    return {
      employees: Array.isArray(obj.employees) ? obj.employees as Array<{ role: string; displayName: string }> : [],
      capabilities: Array.isArray(obj.capabilities) ? obj.capabilities as string[] : [],
    }
  }

  // 旧格式: 数组
  if (Array.isArray(raw)) {
    return { employees: [], capabilities: raw as string[] }
  }

  return { employees: [], capabilities: [] }
}

export interface EntitlementCheck {
  allowed: boolean
  reason?: string
  current: number
  limit: number
}

export interface EntitlementSyncResult {
  created: number
  suspended: number
  archived: number
  total: number
}

export const entitlementService = {
  /**
   * 获取当前企业权益（实时查询）
   */
  async getCurrentEntitlement(organizationId: string) {
    const entitlement = await prisma.enterpriseEntitlement.findFirst({
      where: { organizationId, status: 'active' },
      orderBy: { effectiveFrom: 'desc' },
    })

    if (!entitlement) return null

    // 计算实时使用量
    const [agentCount, channelBindingCount] = await Promise.all([
      prisma.enterpriseAgentInstance.count({
        where: { tenantId: organizationId, status: 'active' },
      }),
      prisma.channelBinding.count({
        where: { channelAccount: { organizationId }, status: 'active' },
      }),
    ])

    return {
      id: entitlement.id,
      subscriptionId: entitlement.subscriptionId,
      agents: {
        limit: entitlement.maxAgents,
        used: agentCount,
        remaining: Math.max(0, entitlement.maxAgents - agentCount),
      },
      channels: {
        limit: entitlement.maxChannels,
        used: channelBindingCount,
        remaining: Math.max(0, entitlement.maxChannels - channelBindingCount),
      },
      members: {
        limit: entitlement.maxMembers,
        used: 0, // TODO: BETA-08.2 成员系统
        remaining: entitlement.maxMembers,
      },
      storage: {
        limit: entitlement.storageLimit,
        used: 0,
        remaining: entitlement.storageLimit,
      },
      capabilityCodes: parseCapabilityCodes(entitlement.capabilityCodes).capabilities,
      features: (entitlement.features as Record<string, boolean>) || {},
      effectiveFrom: entitlement.effectiveFrom,
      effectiveUntil: entitlement.effectiveUntil,
      status: entitlement.status,
    }
  },

  /**
   * 从 Subscription 生成/更新 Entitlement
   */
  async createFromSubscription(
    organizationId: string,
    subscriptionId: string,
    overrides?: { maxAgents?: number; maxChannels?: number; features?: Record<string, boolean> }
  ) {
    // 查找 Plan 的默认额度
    const subscription = await prisma.enterpriseSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    })

    if (!subscription) throw new Error('Subscription not found')

    const plan = subscription.plan
    const features = overrides?.features ||
      (plan?.features as Record<string, boolean>) || {}

    // Sprint-14 Task 04K Step 2: 兼容解析 capabilityCodes 新旧格式
    const parsed = parseCapabilityCodes(plan?.capabilityCodes)

    // Upsert Entitlement — 存储能力列表（不存 employees，那是 provisioning 的职责）
    const entitlement = await prisma.enterpriseEntitlement.upsert({
      where: { subscriptionId },
      update: {
        maxAgents: overrides?.maxAgents ?? plan?.maxEmployees ?? 1,
        maxChannels: overrides?.maxChannels ?? plan?.maxChannels ?? 1,
        features: features as any,
        capabilityCodes: parsed.capabilities,
        status: 'active',
        overrideReason: null,
      },
      create: {
        organizationId,
        subscriptionId,
        maxAgents: overrides?.maxAgents ?? plan?.maxEmployees ?? 1,
        maxChannels: overrides?.maxChannels ?? plan?.maxChannels ?? 1,
        features: features as any,
        capabilityCodes: parsed.capabilities,
        status: 'active',
      },
    })

    return entitlement
  },

  /**
   * 同步 Agent Instance 状态与 Entitlement
   * - 超出限额：suspend 超额 agent
   - 权益恢复：activate 已 suspend 的 agent
   */
  async syncAgents(organizationId: string): Promise<EntitlementSyncResult> {
    const entitlement = await prisma.enterpriseEntitlement.findFirst({
      where: { organizationId, status: 'active' },
    })

    if (!entitlement) return { created: 0, suspended: 0, archived: 0, total: 0 }

    // 获取当前 active agents（按创建时间排序，最早的优先保留）
    const activeAgents = await prisma.enterpriseAgentInstance.findMany({
      where: { tenantId: organizationId, status: 'active' },
      orderBy: { createdAt: 'asc' },
    })

    const suspendedAgents = await prisma.enterpriseAgentInstance.findMany({
      where: { tenantId: organizationId, status: 'suspended' },
      orderBy: { createdAt: 'asc' },
    })

    let suspended = 0
    let activated = 0

    // 超额 → suspend
    if (activeAgents.length > entitlement.maxAgents) {
      const toSuspend = activeAgents.slice(entitlement.maxAgents)
      for (const agent of toSuspend) {
        await prisma.enterpriseAgentInstance.update({
          where: { id: agent.id },
          data: { status: 'suspended' },
        })
        suspended++
      }
    }

    // 有空间 → activate 已 suspend 的
    const currentActive = await prisma.enterpriseAgentInstance.count({
      where: { tenantId: organizationId, status: 'active' },
    })
    const slotsAvailable = entitlement.maxAgents - currentActive
    if (slotsAvailable > 0 && suspendedAgents.length > 0) {
      const toActivate = suspendedAgents.slice(0, slotsAvailable)
      for (const agent of toActivate) {
        await prisma.enterpriseAgentInstance.update({
          where: { id: agent.id },
          data: { status: 'active' },
        })
        activated++
      }
    }

    const total = await prisma.enterpriseAgentInstance.count({
      where: { tenantId: organizationId },
    })

    return { created: 0, suspended, archived: 0, total }
  },

  /**
   * 检查是否允许创建新的 Agent
   */
  async checkAgentCapability(organizationId: string): Promise<EntitlementCheck> {
    const entitlement = await this.getCurrentEntitlement(organizationId)
    if (!entitlement) return { allowed: false, reason: 'No active subscription', current: 0, limit: 0 }

    return {
      allowed: entitlement.agents.used < entitlement.agents.limit,
      current: entitlement.agents.used,
      limit: entitlement.agents.limit,
      reason: entitlement.agents.used >= entitlement.agents.limit
        ? `Agent limit reached (${entitlement.agents.used}/${entitlement.agents.limit})`
        : undefined,
    }
  },

  /**
   * 冻结/解冻 企业权益（用于 payment 逾期、退款、运营操作）
   */
  async setStatus(organizationId: string, status: 'active' | 'suspended' | 'expired', reason?: string) {
    const result = await prisma.enterpriseEntitlement.updateMany({
      where: { organizationId, status: { not: status } },
      data: { status, overrideReason: reason, overrideBy: 'system' },
    })

    // 同步 Agent 状态
    if (status === 'suspended' || status === 'expired') {
      await prisma.enterpriseAgentInstance.updateMany({
        where: { tenantId: organizationId, status: 'active' },
        data: { status: 'suspended' },
      })
    } else if (status === 'active') {
      await this.syncAgents(organizationId)
    }

    return result.count
  },

  /**
   * 获取 Entitlement 完整原始数据
   */
  async getEntitlementRaw(organizationId: string) {
    return prisma.enterpriseEntitlement.findFirst({
      where: { organizationId, status: 'active' },
      orderBy: { effectiveFrom: 'desc' },
    })
  },
}
