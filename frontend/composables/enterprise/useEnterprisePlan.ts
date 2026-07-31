/**
 * useEnterprisePlan.ts — 企业套餐统一逻辑 (Commerce Authority — Single Source of Truth)
 * 
 * All UI components must import from this file for plan display.
 * No component may define its own label/color/tier mapping.
 * 
 * Priority chain for resolvePlanInfo:
 *   1. planTier / tier (API 返回的机器可读标识)
 *   2. planId → lookup from TIER_MAP
 *   3. snapshotName / displayName 关键词兜底
 * 
 * TIER_MAP values correspond to enterprise_plan.name in DB:
 *   trial       → Trial 体验版
 *   basic       → 清包工 ¥299/月
 *   professional → 人事部 ¥999/月
 *   enterprise   → HR猎头 ¥2999/月
 */

export interface PlanTierInfo {
  tier: string
  label: string
  maxEmployees: number
  allowedAgentTypes: string[]
  description: string
}

/**
 * TIER_MAP — 前端单一套餐来源
 * 
 * key matches enterprise_plan.name in DB.
 * All components (header, dashboard, billing, agent cards) must use resolvePlanInfo() or TIER_MAP directly.
 * NEVER define labels inline in components.
 */
export const TIER_MAP: Record<string, PlanTierInfo> = {
  free: {
    tier: 'free',
    label: '免费版',
    maxEmployees: 0,
    allowedAgentTypes: [],
    description: '预览 AI 员工能力',
  },
  basic: {
    tier: 'basic',
    label: '基础版',
    maxEmployees: 1,
    allowedAgentTypes: ['recruiter'],
    description: '1 个 AI 员工 — 招聘顾问 Alice',
  },
  trial: {
    tier: 'trial',
    label: '免费体验版',
    maxEmployees: 1,
    allowedAgentTypes: ['recruiter'],
    description: '免费试用 — 1 个 AI 员工',
  },
  professional: {
    tier: 'professional',
    label: '专业版',
    maxEmployees: 3,
    allowedAgentTypes: ['recruiter', 'interview', 'talent_analyst'],
    description: '3 个 AI 员工 — 覆盖招聘全流程',
  },
  enterprise: {
    tier: 'enterprise',
    label: '企业版',
    maxEmployees: 10,
    allowedAgentTypes: ['recruiter', 'interview', 'talent_analyst', 'marketing', 'operations'],
    description: '10+ AI 员工 — 团队协作与审计',
  },
  pro: {
    tier: 'pro',
    label: '专业版',
    maxEmployees: 3,
    allowedAgentTypes: ['recruiter', 'interview', 'talent_analyst'],
    description: '3 个 AI 员工',
  },
}

/**
 * Resolve plan tier info from a subscription object or tier name.
 * This is the single source of truth for tier → UI mapping.
 * 
 * Priority chain (in order):
 *   1. src.planTier  — API 返回的机器 tier 标识 (e.g. 'professional')
 *   2. src.tier       — 某些上下文传入的 tier 标识
 *   3. src.planId     — UUID, 通过反向查找 TIER_MAP (仅在已知 planId 时生效)
 *   4. src.plan?.name — 嵌套 plan 对象的 name
 *   5. 关键词匹配     — 最后的兜底 (snapshotName / displayName)
 * 
 * This is the SINGLE entry point for ALL plan tier resolution.
 * Components MUST NOT implement their own tier → label mapping.
 */
export function resolvePlanInfo(subscription: any | null): PlanTierInfo {
  if (!subscription) {
    return TIER_MAP.free
  }

  // Handle both flat structure (backend v2) and nested plan.xxx (legacy/fallback)
  const src = subscription.plan ? subscription : subscription

  // ── Priority 1: planTier (API returned) ──
  if (src.planTier) {
    const tier = String(src.planTier).toLowerCase().trim()
    if (TIER_MAP[tier]) return TIER_MAP[tier]
  }

  // ── Priority 2: src.tier ──
  if (src.tier) {
    const tier = String(src.tier).toLowerCase().trim()
    if (TIER_MAP[tier]) return TIER_MAP[tier]
  }

  // ── Priority 3: plan?.name (nested) ──
  if (src.plan?.name) {
    const name = String(src.plan.name).toLowerCase().trim()
    if (TIER_MAP[name]) return TIER_MAP[name]
  }

  // ── Priority 4: raw planName / name ──
  if (src.name) {
    const name = String(src.name).toLowerCase().trim()
    if (TIER_MAP[name]) return TIER_MAP[name]
  }

  // ── Priority 5: Keyword matching (safe fallback) ──
  const planName = (
    src.planName ||
    src.plan?.displayName ||
    src.displayName ||
    ''
  ).toLowerCase()

  if (planName.includes('企业') || planName.includes('enterprise')) return TIER_MAP.enterprise
  if (planName.includes('专业') || planName.includes('人事') || planName.includes('猎头') || planName.includes('hr') || planName.includes('pro') || planName.includes('professional')) return TIER_MAP.professional
  if (planName.includes('基础') || planName.includes('basic')) return TIER_MAP.basic
  if (planName.includes('试用') || planName.includes('trial')) return TIER_MAP.trial

  return TIER_MAP.free
}

export function getPlanLabel(subscription: any | null): string {
  return resolvePlanInfo(subscription).label
}

export function getMaxEmployees(subscription: any | null): number {
  if (subscription?.maxEmployees != null) return subscription.maxEmployees
  return resolvePlanInfo(subscription).maxEmployees
}

/**
 * Check if a specific agent type is allowed for the current subscription.
 */
export function isAgentTypeAllowed(agentType: string, subscription: any | null): boolean {
  const info = resolvePlanInfo(subscription)
  return info.allowedAgentTypes.includes(agentType)
}
