// ============================================================
// EnterpriseSubscription Adapter — M1-A1
// 将 Governance Tenant 映射到 Enterprise Subscription
// 对接 enterprise_subscription 表（企业订阅体系）
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { SubscriptionStatus } from '../types.js'

export interface EnterpriseSubscriptionResult {
  id: string
  organizationId: string
  planId: string
  planName: string
  status: SubscriptionStatus
  /** 是否为有效订阅（active 且未过期） */
  isActive: boolean
  /** 订阅来源快照 */
  snapshot: {
    name: string
    maxEmployees: number
    maxChannels: number
    maxMembers: number
    features: string[]
  }
  /** 原始订阅数据 */
  raw: {
    startAt: Date
    expireAt: Date
    autoRenew: boolean
  }
}

export class EnterpriseSubscriptionAdapter {
  /**
   * 通过组织 ID 获取有效订阅
   * 策略：查询 enterprise_subscription 表，status='active' 且未过期
   */
  async resolveByOrganizationId(organizationId: string): Promise<EnterpriseSubscriptionResult | null> {
    const sub = await prisma.enterpriseSubscription.findFirst({
      where: {
        organizationId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!sub) return null

    // 检查过期
    const now = new Date()
    const isExpired = sub.expireAt && sub.expireAt < now
    const isActive = sub.status === 'active' && !isExpired

    // 解析 features JSON
    let features: string[] = []
    if (sub.snapshotFeatures) {
      try {
        features = typeof sub.snapshotFeatures === 'string'
          ? JSON.parse(sub.snapshotFeatures)
          : sub.snapshotFeatures as any
      } catch {
        features = []
      }
    }

    return {
      id: sub.id,
      organizationId: sub.organizationId,
      planId: sub.planId,
      planName: sub.snapshotName || 'Unknown',
      status: isActive ? 'active' : (isExpired ? 'expired' : sub.status as SubscriptionStatus),
      isActive,
      snapshot: {
        name: sub.snapshotName || 'Unknown',
        maxEmployees: sub.snapshotMaxEmployees ?? 0,
        maxChannels: sub.snapshotMaxChannels ?? 0,
        maxMembers: sub.snapshotMaxMembers ?? 0,
        features,
      },
      raw: {
        startAt: sub.startAt,
        expireAt: sub.expireAt,
        autoRenew: sub.autoRenew,
      },
    }
  }

  /**
   * 通过 Governance TenantId 获取订阅
   * 策略：需要从 GovOrganization → organizationId 映射
   */
  async resolveByTenantId(tenantId: string): Promise<EnterpriseSubscriptionResult | null> {
    // 先找组织
    const org = await prisma.govOrganization.findFirst({
      where: { tenantId },
    })
    if (!org) return null

    // 再用 orgId 查 enterprise_subscription
    // 注意：这里是通过 enterprise_organization 还是 governance_organization？
    // 使用 governance_organization.id 作为 organizationId
    return this.resolveByOrganizationId(org.id)
  }

  /**
   * 获取订阅剩余天数
   */
  getRemainingDays(sub: EnterpriseSubscriptionResult): number {
    if (!sub.raw.expireAt) return -1 // 永久
    const now = new Date()
    const diff = sub.raw.expireAt.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }
}

export const enterpriseSubscriptionAdapter = new EnterpriseSubscriptionAdapter()
