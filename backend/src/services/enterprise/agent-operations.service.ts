/**
 * services/enterprise/agent-operations.service.ts — SPRINT-AGENT-OPERATIONS-01 T02/T03
 *
 * AI 员工运营闭环：健康中心 + 生命周期 + 流失风险
 *
 * 原则：
 * 1. 全部真实数据（EnterpriseAgentTask / UsageLog / AgentOutcome / Subscription / ValueParam）
 * 2. 健康/阶段/风险判定基于可解释规则（阈值明确，注释说明）
 * 3. 价值 ROI 仅在企业配置价值参数后计算，平台不估算
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const round2 = (n: number) => Math.round(n * 100) / 100

export interface AgentHealthRow {
  agentInstanceId: string
  agentName: string | null
  role: string | null
  orgId: string | null
  orgName: string
  runtimeStatus: string
  lifecycleState: string
  // 30 天真实执行
  tasks: number
  succeeded: number
  failed: number
  successRate: number | null
  cost: number
  avgDurationMs: number | null
  outcomes: number
  lastTaskAt: string | null
  // 健康判定（可解释）
  health: {
    level: 'green' | 'yellow' | 'red' | 'idle'
    label: string
    reason: string
  }
  hasValueParam: boolean
}

function healthLevelOf(row: { runtimeStatus: string; tasks: number; failed: number; successRate: number | null; lastTaskAt: string | null; createdAt: string }): AgentHealthRow['health'] {
  const now = Date.now()
  const lastTs = row.lastTaskAt ? new Date(row.lastTaskAt).getTime() : null
  const createdTs = new Date(row.createdAt).getTime()
  const daysSinceLast = lastTs ? (now - lastTs) / 86400000 : null

  if (row.runtimeStatus !== 'active') {
    return { level: 'red', label: '已停用', reason: `运行时状态 ${row.runtimeStatus}，非 active` }
  }
  if (row.tasks === 0) {
    const daysSinceCreated = (now - createdTs) / 86400000
    return {
      level: 'idle',
      label: '待上岗',
      reason: daysSinceCreated >= 7 ? '已部署但 7 天以上无任何执行' : '已部署，尚无执行记录',
    }
  }
  if (row.failed > 0 && row.successRate !== null && row.successRate < 90) {
    return { level: 'red', label: '异常', reason: `30 天成功率 ${row.successRate}%（低于 90%）` }
  }
  if (row.successRate !== null && row.successRate < 95) {
    return { level: 'yellow', label: '注意', reason: `30 天成功率 ${row.successRate}%（低于 95%）` }
  }
  if (daysSinceLast !== null && daysSinceLast > 7) {
    return { level: 'yellow', label: '低活跃', reason: `${Math.round(daysSinceLast)} 天无新执行` }
  }
  return { level: 'green', label: '正常', reason: '30 天内有执行且成功率 ≥ 95%' }
}

/** T02: AI 员工健康中心（管理员罗盘） */
export async function getAgentHealth() {
  const since = new Date(Date.now() - 30 * 86400000)

  const [instances, tasks, outcomes, orgs, valueParams] = await Promise.all([
    prisma.enterpriseAgentInstance.findMany().catch(() => []),
    prisma.enterpriseAgentTask.findMany({
      where: { startedAt: { gte: since } },
      select: { agentInstanceId: true, status: true, cost: true, durationMs: true, startedAt: true, organizationId: true },
    }).catch(() => []),
    prisma.agentOutcome.findMany({
      where: { createdAt: { gte: since } },
      select: { agentInstanceId: true, id: true },
    }).catch(() => []),
    prisma.organization.findMany({ select: { id: true, name: true } }).catch(() => []),
    prisma.enterpriseValueParam.findMany({ select: { organizationId: true, agentInstanceId: true } }).catch(() => []),
  ])

  // 员工档案
  const employeeIds = instances.map((i) => i.employeeId).filter(Boolean)
  const profiles = employeeIds.length
    ? await prisma.enterpriseAgentProfile.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true, role: true } }).catch(() => [])
    : []
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]))
  const orgMap = new Map(orgs.map((o) => [o.id, o.name]))
  const paramSet = new Set(valueParams.map((p) => `${p.organizationId}:${p.agentInstanceId}`))

  const taskMap = new Map<string, { tasks: number; succeeded: number; failed: number; cost: number; durations: number[]; lastTaskAt: string | null }>()
  for (const t of tasks) {
    const key = t.agentInstanceId
    if (!taskMap.has(key)) taskMap.set(key, { tasks: 0, succeeded: 0, failed: 0, cost: 0, durations: [], lastTaskAt: null })
    const s = taskMap.get(key)!
    s.tasks++
    if (t.status === 'success' || t.status === 'completed') s.succeeded++
    else if (t.status === 'failed') s.failed++
    s.cost += t.cost || 0
    if (t.durationMs) s.durations.push(t.durationMs)
    const ts = t.startedAt?.toISOString?.() || null
    if (ts && (!s.lastTaskAt || ts > s.lastTaskAt)) s.lastTaskAt = ts
  }

  const outcomeMap = new Map<string, number>()
  for (const o of outcomes) {
    if (!o.agentInstanceId) continue
    outcomeMap.set(o.agentInstanceId, (outcomeMap.get(o.agentInstanceId) || 0) + 1)
  }

  const rows: AgentHealthRow[] = instances.map((inst) => {
    const stat = taskMap.get(inst.id) || { tasks: 0, succeeded: 0, failed: 0, cost: 0, durations: [], lastTaskAt: null }
    const profile = inst.employeeId ? profileMap.get(inst.employeeId) : null
    const successRate = stat.tasks > 0 ? Math.round((stat.succeeded / stat.tasks) * 1000) / 10 : null
    const avgDurationMs = stat.durations.length ? Math.round(stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length) : null
    const orgId = inst.organizationId || null
    const base = {
      runtimeStatus: inst.runtimeStatus,
      tasks: stat.tasks,
      failed: stat.failed,
      successRate,
      lastTaskAt: stat.lastTaskAt,
      createdAt: inst.createdAt.toISOString(),
    }
    const health = healthLevelOf(base)
    return {
      agentInstanceId: inst.id,
      agentName: profile?.name || null,
      role: profile?.role || null,
      orgId,
      orgName: orgId ? orgMap.get(orgId) || '—' : '—',
      runtimeStatus: inst.runtimeStatus,
      lifecycleState: inst.lifecycleState,
      tasks: stat.tasks,
      succeeded: stat.succeeded,
      failed: stat.failed,
      successRate,
      cost: round2(stat.cost),
      avgDurationMs,
      outcomes: outcomeMap.get(inst.id) || 0,
      lastTaskAt: stat.lastTaskAt,
      hasValueParam: orgId ? paramSet.has(`${orgId}:${inst.id}`) : false,
      health,
    }
  })

  const levelCount = (lvl: string) => rows.filter((r) => r.health.level === lvl).length
  return {
    generatedAt: new Date().toISOString(),
    windowDays: 30,
    summary: {
      total: rows.length,
      green: levelCount('green'),
      yellow: levelCount('yellow'),
      red: levelCount('red'),
      idle: levelCount('idle'),
      working: rows.filter((r) => r.tasks > 0).length,
      producing: rows.filter((r) => r.outcomes > 0).length,
      withValueParam: rows.filter((r) => r.hasValueParam).length,
      note: '健康判定规则（真实数据）：绿=30天有执行且成功率≥95% · 黄=成功率<95%或7天无执行 · 红=非active或成功率<90% · 待上岗=无执行记录',
    },
    agents: rows.sort((a, b) => (b.tasks - a.tasks)),
  }
}

export type LifecycleStage = 'TRIAL' | 'OBSERVING' | 'ACTIVE' | 'DORMANT' | 'EXPIRED' | 'NO_SUBSCRIPTION' | 'RENEWAL_RISK'

export interface EnterpriseLifecycleRow {
  orgId: string
  orgName: string
  planName: string
  subscriptionStatus: string
  stage: LifecycleStage
  stageLabel: string
  agents: number
  workingAgents: number
  tasks30d: number
  cost30d: number
  outcomes30d: number
  savedValue: number | null // 仅企业配置价值参数后非 null
  roiConfigured: boolean
  expireAt: string | null
  daysToExpire: number | null
  risks: string[]
}

/** T03: 企业 AI 员工生命周期 + 流失风险 */
export async function getEnterpriseLifecycle() {
  const since = new Date(Date.now() - 30 * 86400000)
  const now = new Date()

  const [orgs, subs, instances, tasks, outcomes, valueParams] = await Promise.all([
    prisma.organization.findMany({ select: { id: true, name: true, plan: true } }).catch(() => []),
    prisma.enterpriseSubscription.findMany().catch(() => []),
    prisma.enterpriseAgentInstance.findMany({ select: { id: true, organizationId: true, runtimeStatus: true, createdAt: true } }).catch(() => []),
    prisma.enterpriseAgentTask.findMany({
      where: { startedAt: { gte: since } },
      select: { agentInstanceId: true, status: true, cost: true, organizationId: true },
    }).catch(() => []),
    prisma.agentOutcome.findMany({
      where: { createdAt: { gte: since } },
      select: { organizationId: true, id: true, agentInstanceId: true },
    }).catch(() => []),
    prisma.enterpriseValueParam.findMany({ select: { organizationId: true, agentInstanceId: true, laborHourlyCost: true, manualMinutesPerTask: true, aiSecondsPerTask: true } }).catch(() => []),
  ])

  const subMap = new Map(subs.map((s) => [s.organizationId, s]))
  const instByOrg = new Map<string, any[]>()
  for (const i of instances) {
    const orgId = i.organizationId || ''
    if (!instByOrg.has(orgId)) instByOrg.set(orgId, [])
    instByOrg.get(orgId)!.push(i)
  }
  // 30 天任务按 org + 员工聚合
  const taskByOrg = new Map<string, { tasks: number; cost: number; succeeded: number; agentIds: Set<string> }>()
  for (const t of tasks) {
    const orgId = t.organizationId || ''
    if (!taskByOrg.has(orgId)) taskByOrg.set(orgId, { tasks: 0, cost: 0, succeeded: 0, agentIds: new Set() })
    const s = taskByOrg.get(orgId)!
    s.tasks++
    s.cost += t.cost || 0
    if (t.status === 'success' || t.status === 'completed') s.succeeded++
    if (t.agentInstanceId) s.agentIds.add(t.agentInstanceId)
  }
  const outcomeByOrg = new Map<string, number>()
  for (const o of outcomes) {
    if (!o.organizationId) continue
    outcomeByOrg.set(o.organizationId, (outcomeByOrg.get(o.organizationId) || 0) + 1)
  }
  // 价值参数：员工级 → 计算每个员工节省
  const paramByAgent = new Map(valueParams.map((p) => [`${p.organizationId}:${p.agentInstanceId}`, p]))
  const savedValueByOrg = new Map<string, number>()
  for (const [key, p] of paramByAgent) {
    const [orgId, agentId] = key.split(':')
    if (!orgId || !agentId) continue
    // 该员工 30 天成功任务数
    const orgTasks = taskByOrg.get(orgId)
    const agentTaskCount = tasks.filter((t) => t.agentInstanceId === agentId && (t.status === 'success' || t.status === 'completed')).length
    if (agentTaskCount === 0) continue
    const savedMinutes = agentTaskCount * (p.manualMinutesPerTask - p.aiSecondsPerTask / 60)
    const savedValue = (savedMinutes / 60) * p.laborHourlyCost
    savedValueByOrg.set(orgId, (savedValueByOrg.get(orgId) || 0) + savedValue)
    void orgTasks
  }

  const STAGE_META: Record<LifecycleStage, string> = {
    TRIAL: '试用期',
    OBSERVING: '上岗观察期',
    ACTIVE: '稳定运行',
    DORMANT: '沉睡（无执行）',
    EXPIRED: '已到期',
    NO_SUBSCRIPTION: '无订阅',
    RENEWAL_RISK: '续费风险',
  }

  const rows: EnterpriseLifecycleRow[] = orgs.map((org) => {
    const sub = subMap.get(org.id)
    const orgInsts = instByOrg.get(org.id) || []
    const orgTask = taskByOrg.get(org.id) || { tasks: 0, cost: 0, succeeded: 0, agentIds: new Set() }
    const workingAgents = orgInsts.filter((i) => orgTask.agentIds.has(i.id)).length
    const risks: string[] = []
    let stage: LifecycleStage = 'NO_SUBSCRIPTION'

    if (!sub || sub.status === 'cancelled') {
      stage = 'NO_SUBSCRIPTION'
    } else if (sub.status === 'expired' || (sub.expireAt && sub.expireAt <= now)) {
      stage = 'EXPIRED'
    } else if (sub.status === 'trial') {
      stage = 'TRIAL'
    } else {
      // active：观察期（激活 ≤7 天）→ 稳定；无执行 → 沉睡
      const daysActive = sub.startAt ? (now.getTime() - sub.startAt.getTime()) / 86400000 : 999
      if (orgTask.tasks === 0) {
        stage = 'DORMANT'
      } else if (daysActive <= 7) {
        stage = 'OBSERVING'
      } else {
        stage = 'ACTIVE'
      }
    }

    // 续费风险：到期 ≤14 天
    if (sub?.expireAt && sub.expireAt > now && (sub.expireAt.getTime() - now.getTime()) / 86400000 <= 14) {
      risks.push(`订阅 ${Math.ceil((sub.expireAt.getTime() - now.getTime()) / 86400000)} 天后到期（自动续费${sub.autoRenew ? '已开' : '未开'}）`)
      if (stage === 'ACTIVE' || stage === 'OBSERVING') stage = 'RENEWAL_RISK'
    }
    // 流失风险：活跃订阅但 30 天零执行
    if (stage === 'DORMANT' && orgInsts.length > 0) {
      risks.push('已部署 AI 员工但 30 天无任何执行（可能流失）')
    }
    if (sub?.status === 'trial' && orgInsts.length === 0) {
      risks.push('试用订阅但未部署 AI 员工')
    }

    const savedValue = savedValueByOrg.get(org.id)
    const roiConfigured = valueParams.some((p) => p.organizationId === org.id)

    return {
      orgId: org.id,
      orgName: org.name,
      planName: sub?.snapshotName || org.plan || '—',
      subscriptionStatus: sub?.status || 'none',
      stage,
      stageLabel: STAGE_META[stage],
      agents: orgInsts.length,
      workingAgents,
      tasks30d: orgTask.tasks,
      cost30d: round2(orgTask.cost),
      outcomes30d: outcomeByOrg.get(org.id) || 0,
      savedValue: savedValue ? round2(savedValue) : null,
      roiConfigured,
      expireAt: sub?.expireAt?.toISOString() || null,
      daysToExpire: sub?.expireAt ? Math.ceil((sub.expireAt.getTime() - now.getTime()) / 86400000) : null,
      risks,
    }
  }).sort((a, b) => {
    const riskRank = (r: EnterpriseLifecycleRow) => (r.risks.length > 0 ? 0 : 1)
    return riskRank(a) - riskRank(b) || b.tasks30d - a.tasks30d
  })

  const stageCount = (s: LifecycleStage) => rows.filter((r) => r.stage === s).length
  return {
    generatedAt: now.toISOString(),
    windowDays: 30,
    summary: {
      enterprises: rows.length,
      withAgents: rows.filter((r) => r.agents > 0).length,
      working: rows.filter((r) => r.tasks30d > 0).length,
      dormant: stageCount('DORMANT'),
      renewalRisk: stageCount('RENEWAL_RISK'),
      expired: stageCount('EXPIRED'),
      trial: stageCount('TRIAL'),
      observing: stageCount('OBSERVING'),
      active: stageCount('ACTIVE'),
      riskCount: rows.reduce((s, r) => s + r.risks.length, 0),
      stageNote: '阶段规则：试用→观察期(激活≤7天)→稳定运行；30天无执行为沉睡；到期≤14天标记续费风险；已部署但未使用=可能流失',
    },
    enterprises: rows,
  }
}

/** T04 辅助：价值中心 ROI 状态（罗盘 outcomes 端点用） */
export async function getRoiStatus() {
  const since = new Date(Date.now() - 30 * 86400000)
  const [valueParams, orgs, tasks] = await Promise.all([
    prisma.enterpriseValueParam.findMany().catch(() => []),
    prisma.organization.findMany({ select: { id: true, name: true } }).catch(() => []),
    prisma.enterpriseAgentTask.findMany({
      where: { startedAt: { gte: since }, status: { in: ['success', 'completed'] } },
      select: { agentInstanceId: true, cost: true },
    }).catch(() => []),
  ])
  const orgMap = new Map(orgs.map((o) => [o.id, o.name]))
  const costByAgent = new Map<string, number>()
  for (const t of tasks) {
    costByAgent.set(t.agentInstanceId, (costByAgent.get(t.agentInstanceId) || 0) + (t.cost || 0))
  }

  const rois = valueParams.map((p) => {
    const successTasks = tasks.filter((t) => t.agentInstanceId === p.agentInstanceId).length
    const aiCost = costByAgent.get(p.agentInstanceId) || 0
    const savedMinutes = successTasks * (p.manualMinutesPerTask - p.aiSecondsPerTask / 60)
    const savedValue = (savedMinutes / 60) * p.laborHourlyCost
    return {
      orgId: p.organizationId,
      orgName: orgMap.get(p.organizationId) || '—',
      agentInstanceId: p.agentInstanceId,
      laborHourlyCost: p.laborHourlyCost,
      savedMinutes: Math.round(savedMinutes * 10) / 10,
      savedValue: Math.round(savedValue * 100) / 100,
      aiCost: Math.round(aiCost * 10000) / 10000, // 4 位小数（真实成本可能 < ¥0.01）
      roi: aiCost > 0 ? Math.round((savedValue / aiCost) * 100) / 100 : null,
      tasks: successTasks,
    }
  })

  return {
    configuredOrgs: new Set(valueParams.map((p) => p.organizationId)).size,
    configuredAgents: valueParams.length,
    rois: rois.filter((r) => r.tasks > 0),
    note: 'ROI 仅在企业配置价值参数后计算（HR 小时成本/人工耗时/AI 耗时），平台不估算',
  }
}
