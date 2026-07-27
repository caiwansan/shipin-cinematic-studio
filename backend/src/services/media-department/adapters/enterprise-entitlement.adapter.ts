// ============================================================
// EnterpriseEntitlement Adapter — M1-A1
// 将 Subscription 映射到 Entitlement（权益/能力）
// 对接 governance_subscription_plan.capabilities + capability_grant
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { EntitlementDTO, CapabilityGrantDTO } from '../types.js'

export class EnterpriseEntitlementAdapter {
  /**
   * 通过 Plan ID 解析 Entitlement
   * 从 governance_subscription_plan 读取 capabilities JSON
   * 从 governance_capability_grant 读取 grants 列表
   */
  async resolveByPlanId(planId: string): Promise<EntitlementDTO | null> {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        grants: true,
      },
    })

    if (!plan) return null

    // 解析 capabilities JSON
    let capabilities: Record<string, any> = {}
    if (plan.capabilities) {
      try {
        capabilities = typeof plan.capabilities === 'string'
          ? JSON.parse(plan.capabilities)
          : plan.capabilities as any
      } catch {
        capabilities = {}
      }
    }

    // 解析 grants
    const grants: CapabilityGrantDTO[] = plan.grants.map(g => ({
      capability: g.capability,
      limits: g.limits ? JSON.parse(g.limits) : undefined,
    }))

    return {
      planCode: plan.code,
      planName: plan.name,
      productType: (plan as any).productType || 'MEDIA_DEPARTMENT',
      billingCycle: plan.billingCycle,
      capabilities,
      grants,
    }
  }

  /**
   * 通过 Plan Code 解析 Entitlement
   */
  async resolveByPlanCode(planCode: string): Promise<EntitlementDTO | null> {
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { code: planCode },
      include: {
        grants: true,
      },
    })

    if (!plan) return null

    return this.resolveByPlanId(plan.id)
  }

  /**
   * 检查是否包含特定 Capability
   */
  hasCapability(entitlement: EntitlementDTO, capability: string): boolean {
    // 检查 capabilities JSON key
    if (entitlement.capabilities[capability] !== undefined) return true
    // 检查 grants 列表
    return entitlement.grants.some(g => g.capability === capability)
  }

  /**
   * 获取 Capability 的限制配置
   */
  getCapabilityLimits(entitlement: EntitlementDTO, capability: string): Record<string, any> | undefined {
    // 优先从 capabilities JSON 获取
    const capConfig = entitlement.capabilities[capability]
    if (capConfig !== undefined) {
      return typeof capConfig === 'object' ? capConfig : { enabled: capConfig }
    }
    // 从 grants 获取
    const grant = entitlement.grants.find(g => g.capability === capability)
    return grant?.limits
  }

  /**
   * 获取 Media Department 相关的所有 capabilities
   */
  getMediaDepartmentCapabilities(entitlement: EntitlementDTO): string[] {
    const mediaCaps: string[] = []
    const mediaPrefix = 'media.'

    // 从 capabilities JSON 中筛选
    for (const key of Object.keys(entitlement.capabilities)) {
      if (key.startsWith(mediaPrefix) || key.includes('media')) {
        mediaCaps.push(key)
      }
    }

    // 从 grants 中筛选
    for (const grant of entitlement.grants) {
      if ((grant.capability.startsWith(mediaPrefix) || grant.capability.includes('media'))
          && !mediaCaps.includes(grant.capability)) {
        mediaCaps.push(grant.capability)
      }
    }

    return mediaCaps
  }
}

export const enterpriseEntitlementAdapter = new EnterpriseEntitlementAdapter()
