/**
 * ai-department.service.ts — AI 数字部门聚合服务
 * Sprint 4.2.9 Phase 3
 *
 * CEO 首页单一聚合接口，避免前端多次调用底层 API
 * 数据来源：EnterpriseAgentInstance + EnterpriseAgentTask + EmployeeModelBinding
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───

export interface AIAgentOverview {
  name: string
  agentType: string
  status: 'running' | 'idle' | 'paused' | 'error'
  tasks: number       // today
  successRate: number // 0-100
  model: string
  lastActive: string | null
}

export interface AIDepartmentOverview {
  // 核心指标
  totalAgents: number
  activeAgents: number
  todayTasks: number
  successRate: number      // 0-100
  totalCost: number        // today spend
  // 运营指标（Intelligence Loop）
  signalsDiscovered: number
  suggestionsGenerated: number
  tasksExecuted: number
  estimatedValue: number   // estimated business value
  // AI 团队列表
  agents: AIAgentOverview[]
  // 健康度
  health: {
    score: number          // 0-100
    status: string         // 良好 / 注意 / 异常
    taskSuccessRate: number
    errorCount: number
  }
  // 最近活动
  recentActivity: AITimelineEvent[]
}

export interface AITimelineEvent {
  id: string
  agentName: string
  action: string           // human-friendly
  taskType: string
  status: string
  timestamp: string
  durationMs?: number
}

// ─── Service ───

export class AIDepartmentService {

  /**
   * CEO 首页聚合接口 — 一次调用获取 AI 部门全景
   */
  async getOverview(tenantId: string): Promise<AIDepartmentOverview> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Parallel data fetch
    const [instances, profiles, todayTasks, recentTasks, allBindings] = await Promise.all([
      // All agent instances for this tenant
      prisma.enterpriseAgentInstance.findMany({
        where: { tenantId },
      }),
      // All employee profiles
      prisma.enterpriseAgentProfile.findMany({
        where: { tenantId },
        select: { id: true, name: true, agentType: true },
      }),
      // Today's tasks
      prisma.enterpriseAgentTask.findMany({
        where: { tenantId, startedAt: { gte: today } },
      }),
      // Last 20 tasks for activity feed
      prisma.enterpriseAgentTask.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      // Model bindings
      prisma.employeeModelBinding.findMany({
        where: { tenantId, enabled: true },
      }),
    ])

    // Build profile lookup map
    const profileMap = new Map(profiles.map(p => [p.id, p]))

    // ── Aggregate per-agent stats ──
    const agentMap = new Map<string, AIAgentOverview>()
    for (const inst of instances) {
      const profile = profileMap.get(inst.employeeId)
      const modelBinding = allBindings.find(b => b.employeeId === inst.employeeId)
      agentMap.set(inst.employeeId, {
        name: profile?.name || '未命名',
        agentType: profile?.agentType || 'custom',
        status: this.mapRuntimeStatus(inst.runtimeStatus),
        tasks: 0,
        successRate: 100,
        model: modelBinding?.modelName || '未配置',
        lastActive: inst.lastActiveAt?.toISOString() || null,
      })
    }

    // Distribute today's tasks to agents
    let totalSuccess = 0
    let totalFailed = 0
    let totalCost = 0
    for (const task of todayTasks) {
      // Find instance by matching agentInstanceId
      const inst = instances.find(i => i.id === task.agentInstanceId)
      if (inst && agentMap.has(inst.employeeId)) {
        const agent = agentMap.get(inst.employeeId)!
        agent.tasks += 1
      }
      if (task.status === 'success' || task.status === 'completed') totalSuccess++
      else if (task.status === 'failed') totalFailed++
      totalCost += Number(task.cost) || 0
    }

    // Compute per-agent success rate
    for (const [, agent] of agentMap) {
      if (todayTasks.length > 0) {
        agent.successRate = Math.round((totalSuccess / todayTasks.length) * 100)
      }
    }

    // ── Build agent list ──
    const agents = Array.from(agentMap.values())

    // ── Aggregate stats ──
    const totalTasksToday = todayTasks.length
    const activeAgents = instances.filter(i => i.runtimeStatus === 'active' || i.runtimeStatus === 'running').length

    // ── Health ──
    const totalErrorCount = instances.reduce((sum, i) => sum + i.totalErrors, 0)
    const overallSuccessRate = totalSuccess + totalFailed > 0
      ? Math.round((totalSuccess / (totalSuccess + totalFailed)) * 100)
      : 100
    const healthScore = this.computeHealthScore(overallSuccessRate, activeAgents, instances.length)
    const healthStatus = healthScore >= 90 ? '良好' : healthScore >= 70 ? '注意' : '异常'

    // ── Activity feed ──
    const recentActivity: AITimelineEvent[] = recentTasks.slice(0, 10).map(task => {
      const inst = instances.find(i => i.id === task.agentInstanceId)
      const profile = inst ? profileMap.get(inst.employeeId) : undefined
      return {
        id: task.id,
        agentName: profile?.name || 'AI员工',
        action: this.describeTask(task.taskType, task.outputSummary),
        taskType: task.taskType,
        status: task.status,
        timestamp: task.startedAt.toISOString(),
        durationMs: task.durationMs,
      }
    })

    // ── Intelligence Loop metrics (estimated from tasks) ──
    const signalsDiscovered = todayTasks.filter(t => t.taskType === 'market_research' || t.taskType === 'customer_analysis').length
    const suggestionsGenerated = todayTasks.filter(t => t.taskType === 'strategy_planning' || t.taskType === 'report_generation').length
    const tasksExecuted = totalSuccess

    // Estimated value (placeholder — would come from Outcome tracking in Phase 6+)
    const estimatedValue = tasksExecuted * 150 // rough estimate ¥150 per task

    return {
      totalAgents: instances.length,
      activeAgents,
      todayTasks: totalTasksToday,
      successRate: overallSuccessRate,
      totalCost: Math.round(totalCost * 10000) / 10000,
      signalsDiscovered,
      suggestionsGenerated,
      tasksExecuted,
      estimatedValue,
      agents,
      health: {
        score: healthScore,
        status: healthStatus,
        taskSuccessRate: overallSuccessRate,
        errorCount: totalErrorCount,
      },
      recentActivity,
    }
  }

  private mapRuntimeStatus(status: string): 'running' | 'idle' | 'paused' | 'error' {
    if (status === 'active' || status === 'running') return 'running'
    if (status === 'paused') return 'paused'
    if (status === 'error') return 'error'
    return 'idle'
  }

  private computeHealthScore(successRate: number, active: number, total: number): number {
    if (total === 0) return 100
    const activeRatio = active / total
    return Math.round((successRate * 0.7 + activeRatio * 100 * 0.3))
  }

  private describeTask(taskType: string, output?: string | null): string {
    const labels: Record<string, string> = {
      content_generation: '生成内容',
      customer_analysis: '分析客户',
      market_research: '市场调研',
      report_generation: '生成报告',
      lead_scoring: '评分线索',
      sales_followup: '跟进客户',
      customer_service: '处理咨询',
      data_analysis: '数据分析',
      social_media: '社媒运营',
      strategy_planning: '策略规划',
    }
    if (output && output.length > 0) {
      return (labels[taskType] || '完成任务') + `: ${output.slice(0, 40)}`
    }
    return labels[taskType] || '执行任务'
  }
}

export const aiDepartmentService = new AIDepartmentService()
