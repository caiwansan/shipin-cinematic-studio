/**
 * services/enterprise/agent-activity.service.ts — Sprint-RECRUITMENT-REALITY-04 T02
 *
 * Agent Activity Center — AI 员工执行历史
 *
 * 商业价值：客户想知道「我的 AI 员工今天干了什么」
 * 数据源：EnterpriseAgentTask（任务级，含 tokens/cost/duration/status）
 *
 * 提供：
 *  - getActivityCenter({ days, organizationId? }): 汇总 + 按 agent 聚合 + 按天聚合 + 任务流
 */

import { prisma } from '../../utils/index.js'

export interface ActivityQuery {
  days?: number
  organizationId?: string
}

const TASK_TYPE_LABELS: Record<string, string> = {
  generate_reply: '💬 生成回复',
  profile_extraction: '📄 简历解析',
  career_activation: '🎯 职业规划激活',
  interview_recommendation: '🧑‍💼 面试推荐',
  matching_report: '🔗 匹配报告',
  job_analysis: '📋 岗位分析',
  candidate_screening: '🔎 候选人筛选',
  jd_generate: '📝 生成 JD',
  resume_match: '🔗 简历匹配',
  interview_questions: '❓ 面试出题',
  interview_evaluation: '📊 面试评估',
}

export function taskTypeLabel(taskType: string): string {
  // enterprise_agent_xxx 前缀剥掉后查映射
  const key = taskType.replace(/^enterprise_agent_/, '')
  return TASK_TYPE_LABELS[key] || key || taskType
}

export async function getActivityCenter(query: ActivityQuery = {}) {
  const days = Math.min(Math.max(query.days || 7, 1), 90)
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)

  const where: any = { startedAt: { gte: since } }
  if (query.organizationId) where.organizationId = query.organizationId

  // ─── 任务流（最近 200 条）───
  const tasks: any[] = await prisma.enterpriseAgentTask.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: 200,
    include: { organization: { select: { name: true } } },
  })

  // ─── 汇总 ───
  const total = tasks.length
  const succeeded = tasks.filter((t) => t.status === 'success' || t.status === 'completed').length
  const failed = tasks.filter((t) => t.status === 'failed').length
  const totalTokens = tasks.reduce((s, t) => s + (t.tokenInput || 0) + (t.tokenOutput || 0), 0)
  const totalCost = tasks.reduce((s, t) => s + (t.cost || 0), 0)
  const totalDurationMs = tasks.reduce((s, t) => s + (t.durationMs || 0), 0)

  // ─── 按 agent 聚合 ───
  const byAgentMap = new Map<string, any>()
  for (const t of tasks) {
    const key = t.agentInstanceId
    if (!byAgentMap.has(key)) {
      byAgentMap.set(key, {
        agentInstanceId: key,
        tenantId: t.tenantId,
        taskCount: 0,
        succeeded: 0,
        failed: 0,
        tokens: 0,
        cost: 0,
        lastTaskAt: null as string | null,
        taskTypes: new Set<string>(),
      })
    }
    const a = byAgentMap.get(key)
    a.taskCount++
    if (t.status === 'success' || t.status === 'completed') a.succeeded++
    else if (t.status === 'failed') a.failed++
    a.tokens += (t.tokenInput || 0) + (t.tokenOutput || 0)
    a.cost += t.cost || 0
    a.taskTypes.add(taskTypeLabel(t.taskType))
    const ts = t.startedAt.toISOString()
    if (!a.lastTaskAt || ts > a.lastTaskAt) a.lastTaskAt = ts
  }
  const byAgent = [...byAgentMap.values()].map((a) => ({
    ...a,
    taskTypes: [...a.taskTypes],
    successRate: a.taskCount ? Math.round((a.succeeded / a.taskCount) * 100) : 0,
  })).sort((x, y) => y.taskCount - x.taskCount)

  // ─── 按天聚合（曲线数据）───
  const byDayMap = new Map<string, any>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000)
    byDayMap.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), taskCount: 0, cost: 0, tokens: 0 })
  }
  for (const t of tasks) {
    const key = t.startedAt.toISOString().slice(0, 10)
    if (byDayMap.has(key)) {
      const d = byDayMap.get(key)
      d.taskCount++
      d.cost += t.cost || 0
      d.tokens += (t.tokenInput || 0) + (t.tokenOutput || 0)
    }
  }
  const byDay = [...byDayMap.values()]

  // ─── 按任务类型聚合 ───
  const byTypeMap = new Map<string, any>()
  for (const t of tasks) {
    const label = taskTypeLabel(t.taskType)
    if (!byTypeMap.has(label)) byTypeMap.set(label, { taskType: label, count: 0, cost: 0 })
    const x = byTypeMap.get(label)
    x.count++
    x.cost += t.cost || 0
  }
  const byType = [...byTypeMap.values()].sort((a, b) => b.count - a.count)

  return {
    periodDays: days,
    summary: {
      total,
      succeeded,
      failed,
      successRate: total ? Math.round((succeeded / total) * 100) : 0,
      totalTokens,
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalDurationMs,
      avgDurationMs: total ? Math.round(totalDurationMs / total) : 0,
      activeAgents: byAgent.length,
    },
    byAgent,
    byDay,
    byType,
    tasks: tasks.map((t) => ({
      id: t.id,
      organizationId: t.organizationId,
      organizationName: t.organization?.name || null,
      agentInstanceId: t.agentInstanceId,
      taskType: taskTypeLabel(t.taskType),
      inputSummary: t.inputSummary,
      outputSummary: t.outputSummary,
      status: t.status,
      tokenInput: t.tokenInput,
      tokenOutput: t.tokenOutput,
      tokens: (t.tokenInput || 0) + (t.tokenOutput || 0),
      cost: t.cost,
      durationMs: t.durationMs,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
    })),
  }
}

// ─────────────────────────────────────────────────────────────
// Sprint-05 T02: AI Workforce ROI Report — 价值报表（销售武器）
// ─────────────────────────────────────────────────────────────

/** 人工耗时基准（分钟/次）— 每类任务替代的人力工时估算 */
const MANUAL_MINUTES: Record<string, number> = {
  jd_generate: 60,            // 撰写/修订 JD：约 1 小时
  job_analysis: 45,           // 岗位分析：45 分钟
  career_activation: 30,      // 职业规划：30 分钟
  interview_evaluation: 30,   // 面试评估（读回答+评分）：30 分钟
  interview_recommendation: 30, // 面试推荐：30 分钟
  interview_questions: 20,    // 面试出题：20 分钟
  matching_report: 20,        // 匹配报告：20 分钟
  candidate_screening: 15,    // 候选人筛选：15 分钟
  resume_match: 10,           // 简历匹配：10 分钟
  profile_extraction: 8,      // 简历解析：8 分钟
  generate_reply: 5,          // 常规回复：5 分钟
}
const DEFAULT_MANUAL_MINUTES = 15

/** ⚠️ DEPRECATED（SPRINT-AGENT-OPERATIONS-01）：平台硬编码估算已废弃（掌柜冻结：企业输入参数，平台禁止估算）
 *  本文件 getRoiReport 仍保留旧估算仅供历史调用方兼容；新 ROI 一律走 value-param.service / agent-operations.getRoiStatus
 *  禁止再把平台估算值作为业务 ROI 展示 */
const HR_HOURLY_RATE = 50

function manualMinutesFor(taskType: string): number {
  const key = taskType.replace(/^enterprise_agent_/, '')
  return MANUAL_MINUTES[key] ?? DEFAULT_MANUAL_MINUTES
}

export async function getRoiReport(query: ActivityQuery = {}) {
  const days = Math.min(Math.max(query.days || 30, 1), 90)
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)

  const where: any = { startedAt: { gte: since } }
  if (query.organizationId) where.organizationId = query.organizationId

  const tasks: any[] = await prisma.enterpriseAgentTask.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: 5000,
    include: { organization: { select: { name: true } } },
  })

  // ─── 按任务类型聚合 + 人工节省换算 ───
  const byTypeMap = new Map<string, any>()
  const byOrgMap = new Map<string, any>()
  let totalCost = 0
  let totalTokens = 0
  let totalSucceeded = 0
  let totalSavedMinutes = 0

  for (const t of tasks) {
    const label = taskTypeLabel(t.taskType)
    const succeeded = t.status === 'success' || t.status === 'completed'
    const cost = t.cost || 0
    const tokens = (t.tokenInput || 0) + (t.tokenOutput || 0)
    const savedMin = succeeded ? manualMinutesFor(t.taskType) : 0
    totalCost += cost
    totalTokens += tokens
    if (succeeded) totalSucceeded++
    totalSavedMinutes += savedMin

    // byType
    if (!byTypeMap.has(label)) byTypeMap.set(label, {
      taskType: label, count: 0, succeeded: 0, cost: 0, tokens: 0, savedMinutes: 0,
    })
    const bt = byTypeMap.get(label)
    bt.count++
    if (succeeded) bt.succeeded++
    bt.cost += cost
    bt.tokens += tokens
    bt.savedMinutes += savedMin

    // byOrg
    const orgId = t.organizationId || t.tenantId || 'unknown'
    if (!byOrgMap.has(orgId)) byOrgMap.set(orgId, {
      organizationId: orgId,
      organizationName: t.organization?.name || (orgId === 'unknown' ? '未知' : orgId.slice(0, 8)),
      count: 0, succeeded: 0, cost: 0, tokens: 0, savedMinutes: 0,
    })
    const bo = byOrgMap.get(orgId)
    bo.count++
    if (succeeded) bo.succeeded++
    bo.cost += cost
    bo.tokens += tokens
    bo.savedMinutes += savedMin
  }

  const totalSavedHours = totalSavedMinutes / 60
  const totalSavedCost = totalSavedHours * HR_HOURLY_RATE
  const aiCost = totalCost
  const roi = aiCost > 0 ? totalSavedCost / aiCost : (totalSavedCost > 0 ? Infinity : 0)

  return {
    period: { days, since: since.toISOString() },
    params: { hrHourlyRate: HR_HOURLY_RATE, manualMinutesBase: MANUAL_MINUTES },
    summary: {
      taskCount: tasks.length,
      succeeded: totalSucceeded,
      successRate: tasks.length > 0 ? Math.round((totalSucceeded / tasks.length) * 1000) / 10 : 0,
      aiCost: Math.round(aiCost * 10000) / 10000,
      tokens: totalTokens,
      savedMinutes: totalSavedMinutes,
      savedHours: Math.round(totalSavedHours * 100) / 100,
      savedCost: Math.round(totalSavedCost * 100) / 100,
      roi: roi === Infinity ? null : Math.round(roi * 100) / 100,
    },
    byType: [...byTypeMap.values()].sort((a, b) => b.savedMinutes - a.savedMinutes).map((t) => ({
      ...t,
      savedHours: Math.round((t.savedMinutes / 60) * 100) / 100,
      savedCost: Math.round((t.savedMinutes / 60) * HR_HOURLY_RATE * 100) / 100,
    })),
    byOrganization: [...byOrgMap.values()].sort((a, b) => b.savedMinutes - a.savedMinutes).map((o) => ({
      ...o,
      savedHours: Math.round((o.savedMinutes / 60) * 100) / 100,
      savedCost: Math.round((o.savedMinutes / 60) * HR_HOURLY_RATE * 100) / 100,
    })),
  }
}

// ─────────────────────────────────────────────────────────────
// Sprint-06 T02: AI 员工工作日报（销售/老板视角）
//   - getDailyReport: 按日聚合（员工活跃 / 任务类型 / 节省 / 成本 / 健康异常）
// 推送渠道（邮件/站内信）待定；页面实时聚合，可截图分享
// ─────────────────────────────────────────────────────────────

const DAILY_BASELINE: Record<string, number> = {
  jd_generate: 60, job_analysis: 45, interview_evaluation: 30, career_activation: 30,
  interview_recommendation: 30, interview_questions: 20, matching_report: 20,
  candidate_screening: 15, resume_match: 10, profile_extraction: 8,
  generate_reply: 5,
}
const DAILY_HR_RATE = 50

export async function getDailyReport(query: { organizationId?: string; date?: string } = {}) {
  const { organizationId } = query
  // 日期归一：默认昨日（本地时区 +08:00，日报语义）；格式 YYYY-MM-DD
  const localNow = new Date(Date.now() - 86400000) // 本地昨日
  const localDay = query.date
    || `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`
  const day = localDay
  const start = new Date(`${day}T00:00:00+08:00`)
  const end = new Date(start.getTime() + 86400000)

  const where: any = { startedAt: { gte: start, lt: end } }
  if (organizationId) where.organizationId = organizationId

  const tasks: any[] = await prisma.enterpriseAgentTask.findMany({ where })

  // 员工名映射：agentInstanceId → EnterpriseAgentProfile.name（经 Instance.employeeId）
  const agentNames = new Map<string, string>()
  const instIds = [...new Set(tasks.map((t) => t.agentInstanceId).filter(Boolean))]
  if (instIds.length) {
    try {
      const instances: any[] = await prisma.enterpriseAgentInstance.findMany({ where: { id: { in: instIds } }, select: { id: true, employeeId: true } })
      const empIds = [...new Set(instances.map((i) => i.employeeId).filter(Boolean))]
      if (empIds.length) {
        const profiles: any[] = await prisma.enterpriseAgentProfile.findMany({ where: { id: { in: empIds } }, select: { id: true, name: true } })
        const profileName = new Map(profiles.map((p) => [p.id, p.name]))
        instances.forEach((i) => agentNames.set(i.id, profileName.get(i.employeeId) || i.id.slice(0, 10)))
      }
    } catch { /* 表可能不存在 */ }
  }

  const orgs = new Set<string>()
  tasks.forEach((t) => orgs.add(t.organizationId || t.tenantId || 'unknown'))

  const ok = tasks.filter((t) => t.status === 'completed')
  const failed = tasks.filter((t) => t.status === 'failed')
  const successRate = tasks.length ? Math.round((ok.length / tasks.length) * 100) : 0

  // 成本：优先 usageLog 当日聚合，缺失时估算兜底
  let aiCost = 0
  let tokens = 0
  try {
    const logs: any[] = await prisma.usageLog.findMany({
      where: { createdAt: { gte: start, lt: end }, ...(organizationId ? {} : {}) },
      select: { cost: true, tokens: true },
    })
    for (const l of logs) {
      aiCost += l.cost || 0
      const t = typeof l.tokens === 'string' ? JSON.parse(l.tokens || '{}') : l.tokens || {}
      tokens += t.total || 0
    }
  } catch { /* usageLog 可能不存在 */ }

  // 员工聚合
  const byAgentMap = new Map<string, any>()
  for (const t of tasks) {
    const key = t.agentInstanceId || 'unknown'
    if (!byAgentMap.has(key)) byAgentMap.set(key, { agentId: key, agentName: agentNames.get(key) || key.slice(0, 10), count: 0, succeeded: 0, failed: 0 })
    const a = byAgentMap.get(key)
    a.count++
    if (t.status === 'completed') a.succeeded++
    if (t.status === 'failed') a.failed++
  }
  const byAgent = [...byAgentMap.values()].sort((a, b) => b.count - a.count).map((a) => ({
    ...a, successRate: a.count ? Math.round((a.succeeded / a.count) * 100) : 0,
  }))

  // 任务类型聚合 + 节省
  const byTypeMap = new Map<string, any>()
  for (const t of ok) {
    const key = t.taskType || 'unknown'
    if (!byTypeMap.has(key)) byTypeMap.set(key, { taskType: key, count: 0, savedMinutes: 0 })
    const item = byTypeMap.get(key)
    item.count++
    item.savedMinutes += DAILY_BASELINE[key] || 15
  }
  const byType = [...byTypeMap.values()].sort((a, b) => b.savedMinutes - a.savedMinutes).map((t) => ({
    ...t, savedHours: Math.round((t.savedMinutes / 60) * 100) / 100,
    savedCost: Math.round((t.savedMinutes / 60) * DAILY_HR_RATE * 100) / 100,
  }))

  const savedMinutes = byType.reduce((s, t) => s + t.savedMinutes, 0)
  const savedHours = Math.round((savedMinutes / 60) * 100) / 100
  const savedCost = Math.round((savedMinutes / 60) * DAILY_HR_RATE * 100) / 100

  // 当日模型健康异常（组织维度：tenantId 前缀匹配 organizationId 简化处理）
  let healthIssues = 0
  try {
    const badConfigs: any[] = await prisma.enterpriseLlmConfig.findMany({
      where: { healthStatus: { in: ['failed', 'decrypt_error'] } },
      select: { tenantId: true },
    })
    const badTenants = new Set(badConfigs.map((c) => c.tenantId))
    if (organizationId) healthIssues = badTenants.has(organizationId) ? 1 : 0
    else healthIssues = badTenants.size
  } catch { /* 表可能不存在 */ }

  return {
    date: day,
    organizationId: organizationId || null,
    organizationCount: orgs.size,
    summary: {
      tasks: tasks.length, succeeded: ok.length, failed: failed.length, successRate,
      aiCost: Math.round(aiCost * 10000) / 10000, tokens, savedHours, savedCost,
      healthIssues, activeAgents: byAgent.length,
    },
    byAgent,
    byType,
    generatedAt: new Date().toISOString(),
  }
}
