/**
 * services/enterprise/quota.service.ts — Sprint-RECRUITMENT-REALITY-04 T03
 *
 * AI 员工额度体系（Usage Ledger → 配额）
 *
 * 模型：
 *  - EnterprisePlan.quotaConfig: 按能力的月配额（Admin 配置）
 *  - EnterpriseEntitlement.quotaUsage: 当前计费周期的已用计数（重算产生）
 *  - 数据源: EnterpriseAgentTask（已有真实执行记录，无需改 runtime）
 *
 * 本期范围（P2 设计落地）：
 *  - recalcQuotaUsage(organizationId): 按 billing 周期重算已用额度
 *  - getQuotaOverview(): 全企业配额总览（用量/剩余/预警）
 *  - 硬拦截（超额拒绝执行）为 P3 设计项，本期不实现（避免误伤真实客户）
 */

import { prisma } from '../../utils/index.js'

/** taskType → capability 映射（EnterpriseAgentTask.taskType → capability code） */
const TASK_TYPE_CAPABILITY: Record<string, string> = {
  jd_generate: 'AI_JD_GENERATE',
  resume_match: 'AI_RESUME_MATCH',
  interview_questions: 'AI_INTERVIEW',
  interview_evaluation: 'AI_INTERVIEW_SUMMARY',
  candidate_screening: 'AI_CANDIDATE_RECOMMEND',
  generate_reply: 'AI_GENERATE_REPLY',
  profile_extraction: 'AI_RESUME_PARSE',
  career_activation: 'AI_CAREER_PLANNING',
  matching_report: 'AI_RESUME_MATCH',
  job_analysis: 'AI_JOB_ANALYSIS',
  interview_recommendation: 'AI_INTERVIEW',
}

function normalizeTaskType(t: string): string {
  return t.replace(/^enterprise_agent_/, '')
}

/**
 * 重算某企业当前计费周期的已用额度
 * 计费周期：以订阅 effectiveFrom 为起点，每月滚动
 */
export async function recalcQuotaUsage(organizationId: string) {
  const entitlement: any = await prisma.enterpriseEntitlement.findFirst({ where: { organizationId } })
  if (!entitlement) return { organizationId, quotaUsage: null, reason: '无权益记录' }

  const subscription: any = await prisma.enterpriseSubscription.findUnique({ where: { id: entitlement.subscriptionId } })
  const plan: any = subscription?.planId
    ? await prisma.enterprisePlan.findUnique({ where: { id: subscription.planId } })
    : null

  // 计费周期起点：订阅生效日（或本月 1 号，取较晚者）
  const periodStart = new Date(subscription?.activatedAt || entitlement.effectiveFrom || Date.now())
  const now = new Date()
  const periodStartThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const effectiveStart = periodStart > periodStartThisMonth ? periodStart : periodStartThisMonth

  // 从任务表聚合
  const tasks: any[] = await prisma.enterpriseAgentTask.findMany({
    where: { organizationId, startedAt: { gte: effectiveStart } },
    select: { taskType: true, status: true },
  })

  const quotaConfig: Record<string, any> = (plan?.quotaConfig as any) || {}
  const usage: Record<string, any> = {}
  const counts: Record<string, number> = {}
  for (const t of tasks) {
    const cap = TASK_TYPE_CAPABILITY[normalizeTaskType(t.taskType)]
    if (!cap) continue
    if (t.status === 'failed') continue // 失败任务不占额度
    counts[cap] = (counts[cap] || 0) + 1
  }
  for (const [cap, cfg] of Object.entries(quotaConfig)) {
    usage[cap] = { used: counts[cap] || 0, limit: cfg.monthly, unit: cfg.unit || '次', periodStart: effectiveStart.toISOString() }
  }
  // 有消耗但套餐未配额度的能力也记录（unlimited 套餐视角）
  for (const [cap, cnt] of Object.entries(counts)) {
    if (!usage[cap]) usage[cap] = { used: cnt, limit: null, unit: '次', periodStart: effectiveStart.toISOString() }
  }

  await prisma.enterpriseEntitlement.update({ where: { id: entitlement.id }, data: { quotaUsage: usage } })
  return { organizationId, planCode: plan?.code, quotaUsage: usage, periodStart: effectiveStart.toISOString() }
}

/** 全企业配额总览（Admin） */
export async function getQuotaOverview() {
  const entitlements: any[] = await prisma.enterpriseEntitlement.findMany({
    include: { organization: { select: { name: true } }, subscription: { include: { plan: true } } },
  })

  const rows = []
  for (const ent of entitlements) {
    const plan: any = ent.subscription?.plan
    const quotaConfig: Record<string, any> = plan?.quotaConfig || {}
    const usage: Record<string, any> = (ent.quotaUsage as any) || {}
    const items = Object.entries(quotaConfig).map(([cap, cfg]: [string, any]) => {
      const u = usage[cap] || { used: 0 }
      const limit = cfg.monthly
      const used = u.used || 0
      const pct = limit ? Math.round((used / limit) * 100) : 0
      return { capability: cap, used, limit, unit: cfg.unit || '次', pct, level: pct >= 100 ? 'exhausted' : pct >= 80 ? 'warning' : 'normal' }
    })
    rows.push({
      organizationId: ent.organizationId,
      organizationName: ent.organization?.name || null,
      planCode: plan?.code || null,
      planName: plan?.displayName || plan?.name || null,
      status: ent.status,
      items,
    })
  }
  return rows
}

/** 计算某企业配额总览（含预警） */
export async function getOrganizationQuota(organizationId: string) {
  const ent: any = await prisma.enterpriseEntitlement.findFirst({
    where: { organizationId },
    include: { subscription: { include: { plan: true } } },
  })
  if (!ent) return { organizationId, items: [] }
  const plan: any = ent.subscription?.plan
  const quotaConfig: Record<string, any> = plan?.quotaConfig || {}
  const usage: Record<string, any> = (ent.quotaUsage as any) || {}
  const items = Object.entries(quotaConfig).map(([cap, cfg]: [string, any]) => {
    const u = usage[cap] || { used: 0 }
    const limit = cfg.monthly
    const used = u.used || 0
    const pct = limit ? Math.round((used / limit) * 100) : 0
    return { capability: cap, used, limit, unit: cfg.unit || '次', pct, level: pct >= 100 ? 'exhausted' : pct >= 80 ? 'warning' : 'normal' }
  })
  return { organizationId, planCode: plan?.code, planName: plan?.displayName || plan?.name, status: ent.status, items }
}

// ─────────────────────────────────────────────────────────────
// Sprint-05 T03: Quota 消费链（观察模式）
//   - recordUsage: 任务完成后实时累加（消费链）
//   - checkQuota:  执行前检查（超额仅提示，不硬阻断 —— 先观察真实消费）
// 硬拦截（429）为 P3 项，等真实数据沉淀后再开
// ─────────────────────────────────────────────────────────────

/** 当前计费周期起点（与 recalcQuotaUsage 口径一致） */
async function resolvePeriodStart(entitlement: any): Promise<Date> {
  const existing = (entitlement.quotaUsage as any) || {}
  const firstCap = Object.values(existing)[0] as any
  if (firstCap?.periodStart) return new Date(firstCap.periodStart)
  const subscription: any = await prisma.enterpriseSubscription.findUnique({ where: { id: entitlement.subscriptionId } })
  const periodStart = new Date(subscription?.activatedAt || entitlement.effectiveFrom || Date.now())
  const now = new Date()
  const periodStartThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return periodStart > periodStartThisMonth ? periodStart : periodStartThisMonth
}

/**
 * 执行后消费记录（观察模式）：成功任务 → 对应能力计数 +1
 * fire-and-forget 使用（不阻塞主执行链路）
 */
export async function recordUsage(organizationId: string, taskType: string, status: string) {
  if (!organizationId || status === 'failed') return
  const cap = TASK_TYPE_CAPABILITY[normalizeTaskType(taskType)]
  if (!cap) return
  try {
    const entitlement: any = await prisma.enterpriseEntitlement.findFirst({ where: { organizationId } })
    if (!entitlement) return
    const periodStart = await resolvePeriodStart(entitlement)
    const existing: Record<string, any> = (entitlement.quotaUsage as any) || {}
    const cur = existing[cap] || { used: 0, limit: null, unit: '次' }
    // 跨周期重置：periodStart 变化则从 1 起
    const samePeriod = cur.periodStart ? new Date(cur.periodStart).getTime() === periodStart.getTime() : true
    const next: Record<string, any> = {
      ...existing,
      [cap]: {
        used: samePeriod ? (cur.used || 0) + 1 : 1,
        limit: cur.limit,
        unit: cur.unit || '次',
        periodStart: periodStart.toISOString(),
      },
    }
    await prisma.enterpriseEntitlement.update({ where: { id: entitlement.id }, data: { quotaUsage: next } })
  } catch (e: any) {
    console.warn(`[Quota] recordUsage 失败（观察模式，不阻断）: ${e.message}`)
  }
}

/**
 * 执行前检查（观察模式）：返回额度状态，不阻断执行
 * 超额仅告警（日志 + 返回 exhausted 标记），供运营观察真实消费
 */
export async function checkQuota(organizationId: string, taskType: string): Promise<{
  capability: string | null
  used: number
  limit: number | null
  remaining: number | null
  exhausted: boolean
  level: 'normal' | 'warning' | 'exhausted' | 'unknown'
}> {
  const cap = TASK_TYPE_CAPABILITY[normalizeTaskType(taskType)]
  if (!organizationId || !cap) return { capability: cap, used: 0, limit: null, remaining: null, exhausted: false, level: 'unknown' }
  try {
    const entitlement: any = await prisma.enterpriseEntitlement.findFirst({ where: { organizationId } })
    if (!entitlement) return { capability: cap, used: 0, limit: null, remaining: null, exhausted: false, level: 'unknown' }
    const existing: Record<string, any> = (entitlement.quotaUsage as any) || {}
    const cur = existing[cap] || { used: 0, limit: null }
    const used = cur.used || 0
    const limit = cur.limit
    if (limit === null || limit === undefined) return { capability: cap, used, limit: null, remaining: null, exhausted: false, level: 'normal' }
    const remaining = Math.max(limit - used, 0)
    const pct = limit > 0 ? (used / limit) * 100 : 0
    return {
      capability: cap,
      used,
      limit,
      remaining,
      exhausted: used >= limit,
      level: used >= limit ? 'exhausted' : pct >= 80 ? 'warning' : 'normal',
    }
  } catch {
    return { capability: cap, used: 0, limit: null, remaining: null, exhausted: false, level: 'unknown' }
  }
}
