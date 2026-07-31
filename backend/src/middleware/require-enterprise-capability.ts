/**
 * middleware/require-enterprise-capability.ts — 企业 Capability Gate 中间件
 *
 * Sprint-RECRUITMENT-REALITY-02-B Task 01: Capability Gate
 * 目标链路: 按钮 → API → Capability → Subscription → Agent Runtime
 *
 * 统一能力代码: UPPER_SNAKE_CASE（P1-Capability-Model-v1.0 FROZEN 规范）
 * 兼容旧代码: 招聘层历史 capability_codes（resume_analysis 等）→ 新代码别名映射
 *
 * 授权检查（任一通过即 granted）:
 *   A. 招聘层: EnterpriseSubscription(active/trial) → EnterpriseEntitlement.capability_codes
 *      - 空数组 = 全部能力开放（Enterprise 级）
 *      - 旧代码经别名映射到新代码
 *   B. 平台层: Subscription(active) → SubscriptionPlan.grants（P1 Frozen 规范）
 *
 * 拒绝响应: 403 + CAPABILITY_DENIED + 引导信息（前端可跳转购买页）
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import { getEnterpriseContext } from '../repositories/recruitment/enterprise-member.repository.js'

// ─── Capability 别名映射（旧代码 → P1 规范代码） ───
const CAPABILITY_ALIAS: Record<string, string[]> = {
  // 招聘域历史代码 → 新代码
  resume_analysis: ['AI_RESUME_MATCH'],
  candidate_search: ['CANDIDATE_SEARCH'],
  candidate_scoring: ['AI_CANDIDATE_RECOMMEND'],
  candidate_outreach: ['CANDIDATE_CONTACT'],
  interview_evaluation: ['AI_INTERVIEW_SUMMARY', 'AI_INTERVIEW'],
  interview_management: ['AI_INTERVIEW'],
  job_publishing: ['JOB_PUBLISH', 'JOB_CREATE', 'JOB_MANAGE'],
  recruitment_report: ['TEAM_ANALYTICS'],
  jd_generate: ['AI_JD_GENERATE'],
  // 营销域历史代码（暂不 gate 招聘 API，保留映射占位）
  market_analysis: ['AI_CANDIDATE_RECOMMEND'],
  strategy_planning: ['AI_CANDIDATE_RECOMMEND'],
  customer_management: ['CANDIDATE_CONTACT'],
}

export class CapabilityDeniedError extends Error {
  public readonly statusCode = 403
  constructor(public readonly capability: string) {
    super(`CAPABILITY_DENIED: ${capability}`)
    this.name = 'CapabilityDeniedError'
  }
}

/** 将任意旧/新能力代码统一解析为新代码集合 */
export function normalizeCapability(code: string): string[] {
  if (CAPABILITY_ALIAS[code]) return CAPABILITY_ALIAS[code]
  return [code] // 已是新代码（或未知代码，原样保留）
}

/** 解析 capability_codes 字段（兼容 JSON 数组 / 旧对象格式 / 字符串） */
function parseCapabilityCodes(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((c): c is string => typeof c === 'string')
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : []
    } catch {
      return []
    }
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.capabilities)) return obj.capabilities.filter((c): c is string => typeof c === 'string')
  }
  return []
}

export interface EnterpriseCapabilityCheck {
  granted: boolean
  source: 'entitlement' | 'platform-grant' | null
  denied?: string[]
}

/**
 * 统一能力授权检查（供中间件与业务层复用）
 */
export async function checkEnterpriseCapability(
  tenantId: string,
  capability: string,
): Promise<EnterpriseCapabilityCheck> {
  if (!tenantId) return { granted: false, source: null }

  const requested = normalizeCapability(capability)

  // ─── A. 招聘层: EnterpriseEntitlement（实时权益，以 entitlement.status=active 为准） ───
  // 不依赖 subscription 状态（订阅可 cancelled 但权益仍生效，以 entitlement 为唯一实时来源）
  const entitlement = await prisma.enterpriseEntitlement.findFirst({
    where: { organizationId: tenantId, status: 'active' },
    orderBy: { effectiveFrom: 'desc' },
  })
  if (entitlement) {
    const entitledCodes = parseCapabilityCodes((entitlement as any).capabilityCodes)
    // 空数组 = 全部能力开放（Enterprise 级）
    if (entitledCodes.length === 0) {
      return { granted: true, source: 'entitlement' }
    }
    // 旧代码 → 新代码别名归一化后匹配
    const entitledSet = new Set<string>()
    for (const code of entitledCodes) {
      for (const normalized of normalizeCapability(code)) entitledSet.add(normalized)
    }
    const denied = requested.filter((c) => !entitledSet.has(c))
    if (denied.length === 0) {
      return { granted: true, source: 'entitlement' }
    }
  }

  // ─── B. 平台层: Subscription → SubscriptionPlan.grants（P1 Frozen 规范） ───
  const platformSub = await prisma.subscription.findFirst({
    where: { tenantId, status: 'active' },
    include: { plan: { include: { grants: true } } },
    orderBy: { createdAt: 'desc' },
  })
  if (platformSub?.plan?.grants?.length) {
    const grantedSet = new Set(platformSub.plan.grants.map((g) => g.capability))
    if (requested.every((c) => grantedSet.has(c))) {
      return { granted: true, source: 'platform-grant' }
    }
  }

  return { granted: false, source: null, denied: requested }
}

/**
 * requireEnterpriseCapability 中间件工厂
 * 用法: fastify.post('/path', { preHandler: requireEnterpriseCapability('AI_JD_GENERATE') }, handler)
 */
export function requireEnterpriseCapability(capability: string) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.user as any
    if (!user?.id) {
      reply.status(401).send({ error: '未认证', message: '请先登录' })
      return
    }

    // 1. 解析 tenantId（JWT → OrgMember 反查）
    let tenantId: string | null = user.tenantId || user.enterpriseId || null
    if (!tenantId) {
      const ctx = await getEnterpriseContext(user.id).catch(() => null)
      tenantId = ctx?.enterpriseId || null
    }
    if (!tenantId) {
      reply.status(403).send({
        capability,
        error: '无企业上下文',
        message: '请先加入或创建一个企业',
      })
      return
    }

    // 2. 能力授权检查
    const check = await checkEnterpriseCapability(tenantId, capability)
    if (!check.granted) {
      reply.status(403).send({
        capability,
        error: 'CAPABILITY_DENIED',
        message: `当前套餐未包含该能力（${capability}），请升级套餐或联系管理员开通`,
        denied: check.denied,
        upgrade: '/api/enterprise/plans',
      })
      return
    }

    // 3. 通过 → 挂载上下文供 handler 复用
    ;(request as any).entitlement = {
      tenantId,
      capability,
      source: check.source,
    }
  }
}
