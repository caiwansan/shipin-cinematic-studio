/**
 * services/enterprise/value-param.service.ts — SPRINT-AGENT-OPERATIONS-01 T01
 *
 * 企业价值参数（ROI 前置）
 *
 * 掌柜冻结原则（Reality）：
 * 1. 价值参数由企业输入（HR 小时成本 / 人工耗时 / AI 耗时），平台禁止估算、禁止猜测默认值
 * 2. 未配置价值参数 → ROI 一律不展示（返回 null + note「待企业配置价值参数」）
 * 3. 价值计算只基于真实成功执行次数 × 企业自定参数
 * 4. 平台硬编码 HR_HOURLY_RATE / MANUAL_MINUTES 估算逻辑（agent-activity.service getRoiReport）→ 废弃
 *
 * 价值公式（透明可解释）：
 *   节省时间(分钟) = 成功任务数 × (manualMinutesPerTask - aiSecondsPerTask / 60)
 *   节省价值(¥)   = 节省时间(小时) × laborHourlyCost
 *   AI 成本(¥)    = 该员工真实任务成本（EnterpriseAgentTask.cost）
 *   ROI           = 节省价值 / AI 成本（AI 成本 > 0 时）
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface ValueParamInput {
  laborHourlyCost: number
  manualMinutesPerTask: number
  aiSecondsPerTask: number
  note?: string | null
}

export interface AgentValueStat {
  agentInstanceId: string
  agentName: string | null
  role: string | null
  workspace: string
  // 真实执行统计（30 天）
  tasks: number
  succeeded: number
  failed: number
  successRate: number | null
  cost: number
  avgDurationMs: number | null
  outcomes: number
  lastTaskAt: string | null
  // 价值参数
  param: {
    laborHourlyCost: number
    manualMinutesPerTask: number
    aiSecondsPerTask: number
  } | null
  // 价值计算（有参数才非 null）
  value: {
    savedMinutes: number
    savedValue: number
    aiCost: number
    roi: number | null
    note?: string
  } | null
}

const DAYS = 30

/** 企业 AI 员工价值参数列表 + 30 天真实统计 */
export async function listValueParams(orgId: string): Promise<{ agents: AgentValueStat[]; summary: any }> {
  const since = new Date(Date.now() - DAYS * 86400000)

  const [instances, params, tasks, outcomes] = await Promise.all([
    prisma.enterpriseAgentInstance.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    }).catch(() => []),
    prisma.enterpriseValueParam.findMany({ where: { organizationId: orgId } }).catch(() => []),
    prisma.enterpriseAgentTask.findMany({
      where: { organizationId: orgId, startedAt: { gte: since } },
      select: { agentInstanceId: true, status: true, cost: true, durationMs: true, startedAt: true },
    }).catch(() => []),
    prisma.agentOutcome.findMany({
      where: { organizationId: orgId, createdAt: { gte: since } },
      select: { agentInstanceId: true, id: true },
    }).catch(() => []),
  ])

  // 员工档案（名字）
  const employeeIds = instances.map((i) => i.employeeId).filter(Boolean)
  const profiles = employeeIds.length
    ? await prisma.enterpriseAgentProfile.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, name: true, role: true, agentType: true },
      }).catch(() => [])
    : []
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]))

  // 聚合任务
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

  // 聚合 outcome
  const outcomeMap = new Map<string, number>()
  for (const o of outcomes) {
    if (!o.agentInstanceId) continue
    outcomeMap.set(o.agentInstanceId, (outcomeMap.get(o.agentInstanceId) || 0) + 1)
  }

  const paramMap = new Map(params.map((p) => [p.agentInstanceId, p]))

  const agents: AgentValueStat[] = instances.map((inst) => {
    const stat = taskMap.get(inst.id) || { tasks: 0, succeeded: 0, failed: 0, cost: 0, durations: [], lastTaskAt: null }
    const param = paramMap.get(inst.id) || null
    const profile = inst.employeeId ? profileMap.get(inst.employeeId) : null
    const successRate = stat.tasks > 0 ? Math.round((stat.succeeded / stat.tasks) * 1000) / 10 : null
    const avgDurationMs = stat.durations.length ? Math.round(stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length) : null

    let value: AgentValueStat['value'] = null
    if (param) {
      const savedMinutes = stat.succeeded * (param.manualMinutesPerTask - param.aiSecondsPerTask / 60)
      const savedValue = (savedMinutes / 60) * param.laborHourlyCost
      const aiCost = Math.round(stat.cost * 10000) / 10000
      value = {
        savedMinutes: Math.round(savedMinutes * 10) / 10,
        savedValue: Math.round(savedValue * 100) / 100,
        aiCost,
        roi: aiCost > 0 ? Math.round((savedValue / aiCost) * 100) / 100 : (savedValue > 0 ? null : 0),
      }
    }

    return {
      agentInstanceId: inst.id,
      agentName: profile?.name || null,
      role: profile?.role || null,
      workspace: 'recruitment',
      tasks: stat.tasks,
      succeeded: stat.succeeded,
      failed: stat.failed,
      successRate,
      cost: Math.round(stat.cost * 10000) / 10000,
      avgDurationMs,
      outcomes: outcomeMap.get(inst.id) || 0,
      lastTaskAt: stat.lastTaskAt,
      param: param ? {
        laborHourlyCost: param.laborHourlyCost,
        manualMinutesPerTask: param.manualMinutesPerTask,
        aiSecondsPerTask: param.aiSecondsPerTask,
      } : null,
      value,
    }
  })

  const configured = agents.filter((a) => a.param).length
  const withValue = agents.filter((a) => a.value && a.value.savedValue > 0).length
  const totalSavedValue = agents.reduce((s, a) => s + (a.value?.savedValue || 0), 0)
  const totalAiCost = agents.reduce((s, a) => s + (a.value?.aiCost || 0), 0)
  const totalSavedMinutes = agents.reduce((s, a) => s + (a.value?.savedMinutes || 0), 0)

  return {
    agents,
    summary: {
      windowDays: DAYS,
      agentCount: agents.length,
      configuredCount: configured,
      withValueCount: withValue,
      totalSavedValue: Math.round(totalSavedValue * 100) / 100,
      totalAiCost: Math.round(totalAiCost * 10000) / 10000,
      totalSavedMinutes: Math.round(totalSavedMinutes * 10) / 10,
      roiNote: configured === 0 ? '价值参数未配置：企业需输入 HR 小时成本/人工耗时/AI 耗时后启用 ROI（平台不估算）' : undefined,
    },
  }
}

/** 保存/更新某员工价值参数（upsert，企业自定） */
export async function saveValueParam(orgId: string, agentInstanceId: string, input: ValueParamInput) {
  // 校验参数合理性（防御：必须为正数，AI 耗时不能大于人工耗时太多）
  const laborHourlyCost = Number(input.laborHourlyCost)
  const manualMinutesPerTask = Number(input.manualMinutesPerTask)
  const aiSecondsPerTask = Number(input.aiSecondsPerTask)
  if (![laborHourlyCost, manualMinutesPerTask, aiSecondsPerTask].every((v) => Number.isFinite(v) && v > 0)) {
    throw new Error('价值参数必须全部为正数')
  }
  if (aiSecondsPerTask >= manualMinutesPerTask * 60) {
    throw new Error('AI 完成耗时必须小于人工完成耗时（否则无节省价值）')
  }

  // 员工归属校验：该实例必须属于该企业
  const inst = await prisma.enterpriseAgentInstance.findFirst({ where: { id: agentInstanceId, organizationId: orgId } })
  if (!inst) throw new Error('AI 员工不存在或不属于当前企业')

  const record = await prisma.enterpriseValueParam.upsert({
    where: { organizationId_agentInstanceId: { organizationId: orgId, agentInstanceId } },
    create: {
      organizationId: orgId,
      agentInstanceId,
      workspace: 'recruitment',
      laborHourlyCost,
      manualMinutesPerTask,
      aiSecondsPerTask,
      note: input.note || null,
    },
    update: {
      laborHourlyCost,
      manualMinutesPerTask,
      aiSecondsPerTask,
      note: input.note || null,
    },
  })
  return { saved: true, recordId: record.id }
}

/** 删除价值参数（回到未配置 → ROI 不展示） */
export async function deleteValueParam(orgId: string, agentInstanceId: string) {
  await prisma.enterpriseValueParam.deleteMany({ where: { organizationId: orgId, agentInstanceId } })
  return { deleted: true }
}
