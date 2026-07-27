// ============================================================
// MediaDepartmentContextService — M1-A1
// Media Department 产品层访问昆仑镜上下文的统一入口
// ============================================================
// 定位：
//   不是 Auth Service
//   不是 Tenant Service
//   不是 Subscription Service
//   它是：Media Department 产品层访问昆仑镜上下文的统一入口
// ============================================================

import { govUserAdapter } from '../adapters/gov-user.adapter.js'
import { govOrganizationAdapter } from '../adapters/gov-organization.adapter.js'
import { enterpriseSubscriptionAdapter } from '../adapters/enterprise-subscription.adapter.js'
import { enterpriseEntitlementAdapter } from '../adapters/enterprise-entitlement.adapter.js'
import { agentAccessResolver } from '../adapters/agent-access-resolver.js'
import { contextAuditService } from './context-audit.service.js'
import type {
  MediaDepartmentContext,
  EntitlementDTO,
  ContextResolutionError,
} from '../types.js'

// ─── 配置常量 ───

/** Media Department 必需的 Capability */
const MEDIA_DEPARTMENT_REQUIRED_CAPABILITY = 'media.department.access'

/** 默认 Agent 上限（当订阅未配置时） */
const DEFAULT_MAX_AGENTS = 3

// ─── 主 Service ───

export class MediaDepartmentContextService {
  /**
   * 解析 Media Department 上下文
   * 
   * @param userId 平台 User.id
   * @returns 冻结的 MediaDepartmentContext
   * @throws ContextResolutionError
   *   - ORGANIZATION_REQUIRED: 用户无企业归属
   *   - SUBSCRIPTION_REQUIRED: 企业无有效订阅
   *   - CAPABILITY_REQUIRED: 订阅不包含 Media Department 能力
   */
  async resolve(userId: string): Promise<MediaDepartmentContext> {
    const startTime = Date.now()

    // ── Step 1: GovUser 身份解析 ──
    const govUserResult = await govUserAdapter.resolveByUserId(userId)
    if (!govUserResult) {
      throw new ContextResolutionError(
        'ORGANIZATION_REQUIRED',
        `User ${userId} has no GovUser identity. Cannot resolve organization.`
      )
    }

    const { govUser } = govUserResult

    // ── Step 2: GovOrganization 解析 ──
    const orgResult = await govOrganizationAdapter.resolveByGovUser(govUser.tenantId)
    if (!orgResult) {
      throw new ContextResolutionError(
        'ORGANIZATION_REQUIRED',
        `GovUser ${govUser.id} has no organization in tenant ${govUser.tenantId}.`
      )
    }

    const { organization } = orgResult

    // ── Step 3: Enterprise Subscription 解析 ──
    const subscription = await enterpriseSubscriptionAdapter.resolveByOrganizationId(organization.id)
    if (!subscription || !subscription.isActive) {
      throw new ContextResolutionError(
        'SUBSCRIPTION_REQUIRED',
        `Organization ${organization.id} has no active subscription.`
      )
    }

    // ── Step 4: Entitlement 解析 ──
    const entitlement = await enterpriseEntitlementAdapter.resolveByPlanId(subscription.planId)

    // ── Step 5: Capability 校验 ──
    if (entitlement && !enterpriseEntitlementAdapter.hasCapability(entitlement, MEDIA_DEPARTMENT_REQUIRED_CAPABILITY)) {
      throw new ContextResolutionError(
        'CAPABILITY_REQUIRED',
        `Subscription plan ${entitlement.planCode} does not include required capability: ${MEDIA_DEPARTMENT_REQUIRED_CAPABILITY}`
      )
    }

    // ── Step 6: Agent Access 解析 ──
    const maxAgents = subscription.snapshot.maxEmployees || DEFAULT_MAX_AGENTS
    const agentAccess = await agentAccessResolver.resolveByOrganizationId(organization.id, maxAgents)

    // ── Step 7: 组装冻结输出 ──
    const context: MediaDepartmentContext = {
      userId,
      organizationId: organization.id,
      tenantId: govUser.tenantId,
      subscriptionStatus: subscription.status,
      entitlement: entitlement || this.emptyEntitlement(),
      capabilities: entitlement ? enterpriseEntitlementAdapter.getMediaDepartmentCapabilities(entitlement) : [],
      agentAccess,
    }

    // ── Step 8: 审计日志 ──
    const resolutionTimeMs = Date.now() - startTime
    await contextAuditService.logResolution({
      userId,
      organizationId: organization.id,
      tenantId: govUser.tenantId,
      timestamp: new Date(),
      action: 'context_resolved',
      resolutionTimeMs,
    })

    return context
  }

  /**
   * 快速检查（不抛异常）
   * 返回 { ok, context?, error? }
   */
  async check(userId: string): Promise<{ ok: true; context: MediaDepartmentContext } | { ok: false; error: ContextResolutionError }> {
    try {
      const context = await this.resolve(userId)
      return { ok: true, context }
    } catch (err) {
      if (err instanceof ContextResolutionError) {
        return { ok: false, error: err }
      }
      throw err
    }
  }

  /**
   * 获取用户最近的 Context Resolution 审计记录
   */
  async getAuditHistory(userId: string, limit = 20) {
    return contextAuditService.queryByUser(userId, limit)
  }

  /**
   * 获取组织的 Context Resolution 审计记录
   */
  async getOrgAuditHistory(organizationId: string, limit = 50) {
    return contextAuditService.queryByOrganization(organizationId, limit)
  }

  // ─── Private ───

  private emptyEntitlement(): EntitlementDTO {
    return {
      planCode: 'none',
      planName: 'No Plan',
      productType: 'MEDIA_DEPARTMENT',
      billingCycle: 'none',
      capabilities: {},
      grants: [],
    }
  }
}

export const mediaDepartmentContextService = new MediaDepartmentContextService()
