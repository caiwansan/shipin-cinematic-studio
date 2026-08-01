/**
 * SPRINT-AGENT-OUTCOME-01: 统一 Agent Outcome Registry（价值层 SSOT）
 *
 * 原则（掌柜冻结）：
 * 1. 禁止各 Workspace 自建结果表（RecruitmentOutcome / CareerOutcome / HDZOutcome 全禁止）
 * 2. 所有 AI 员工业务结果统一写入 agent_outcome，workspace 字段区分业务线
 * 3. 数据必须来自真实执行结果（业务动作完成点调用），禁止估算 / Mock / 伪造
 * 4. 不修改 Runtime 链路：本服务只做「结果登记」，执行/成本链路保持原样
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Outcome 类型注册表（防 typo，workspace 隔离） ───
export const OUTCOME_TYPES = {
  // 招聘 AI 员工（workspace: recruitment）
  recruitment: {
    CANDIDATE_RECEIVED: 'CANDIDATE_RECEIVED', // 渠道候选人导入成功（Alice）
    EVALUATION_GENERATED: 'EVALUATION_GENERATED', // AI 评价真实生成（Bob）
    CANDIDATE_SCREENED: 'CANDIDATE_SCREENED', // 候选人进入筛选（Alice）
    INTERVIEW_CREATED: 'INTERVIEW_CREATED', // 面试创建（Alice）
    HIRING_RECOMMENDATION: 'HIRING_RECOMMENDATION', // 录用建议（Bob）
    CANDIDATE_RANKED: 'CANDIDATE_RANKED', // 候选人排名（Carol，待对应功能接入）
    TALENT_REPORT_CREATED: 'TALENT_REPORT_CREATED', // 人才报告（Carol，待对应功能接入）
  },
  // 求职管家（workspace: career）
  career: {
    RESUME_OPTIMIZED: 'RESUME_OPTIMIZED', // 简历优化
    CAREER_PLAN_CREATED: 'CAREER_PLAN_CREATED', // 职业规划生成
    INTERVIEW_SIMULATION_COMPLETED: 'INTERVIEW_SIMULATION_COMPLETED', // 模拟面试完成
    JOB_MATCH_GENERATED: 'JOB_MATCH_GENERATED', // 岗位匹配生成
    SKILL_GAP_ANALYZED: 'SKILL_GAP_ANALYZED', // 技能差距分析
    SALARY_GUIDE_GENERATED: 'SALARY_GUIDE_GENERATED', // 薪资谈判指南
    CAREER_TASK_COMPLETED: 'CAREER_TASK_COMPLETED', // 自治任务完成（job_watch 等）
  },
  // 短剧 AI 导演（workspace: shortdrama，预留，未来接入）
  shortdrama: {
    SCRIPT_ANALYZED: 'SCRIPT_ANALYZED',
    CHARACTER_CREATED: 'CHARACTER_CREATED',
    STORYBOARD_GENERATED: 'STORYBOARD_GENERATED',
    VIDEO_RENDER_COMPLETED: 'VIDEO_RENDER_COMPLETED',
  },
} as const

export type OutcomeWorkspace = keyof typeof OUTCOME_TYPES

export interface RecordOutcomeParams {
  organizationId?: string | null
  userId?: string | null
  agentInstanceId?: string | null
  workspace: OutcomeWorkspace
  outcomeType: string
  sourceExecutionId?: string | null
  metricValue?: number
  metadata?: Record<string, any> | null
}

class OutcomeRegistry {
  /**
   * 登记一次真实业务结果。
   * 幂等：同一 sourceExecutionId + outcomeType 不重复登记（防重放/重试双写）。
   */
  async record(params: RecordOutcomeParams): Promise<{ id: string; deduped: boolean } | null> {
    try {
      const { organizationId, userId, agentInstanceId, workspace, outcomeType, sourceExecutionId, metricValue, metadata } = params

      // 类型合法性校验（防伪造/typo）
      const registry = OUTCOME_TYPES[workspace]
      if (!registry || !Object.values(registry).includes(outcomeType as any)) {
        console.warn(`[OutcomeRegistry] ⚠️ unknown outcomeType=${outcomeType} workspace=${workspace} — rejected`)
        return null
      }

      // 幂等：同来源执行记录 + 同类型只记一次
      if (sourceExecutionId) {
        const existing = await prisma.agentOutcome.findFirst({
          where: { sourceExecutionId, outcomeType },
          select: { id: true },
        })
        if (existing) return { id: existing.id, deduped: true }
      }

      const created = await prisma.agentOutcome.create({
        data: {
          organizationId: organizationId || null,
          userId: userId || null,
          agentInstanceId: agentInstanceId || null,
          workspace,
          outcomeType,
          sourceExecutionId: sourceExecutionId || null,
          metricValue: metricValue ?? 1,
          metadata: (metadata as any) || undefined,
        },
      })
      return { id: created.id, deduped: false }
    } catch (e: any) {
      // 结果登记失败不阻断业务主流程（结果层尽力而为）
      console.error(`[OutcomeRegistry] ❌ record failed: ${e.message}`)
      return null
    }
  }

  /**
   * 聚合：按 workspace × outcomeType 计数（真实结果数）
   */
  async summarize(opts: { organizationId?: string; userId?: string; from?: Date; to?: Date }): Promise<any[]> {
    const where: any = {}
    if (opts.organizationId) where.organizationId = opts.organizationId
    if (opts.userId) where.userId = opts.userId
    if (opts.from || opts.to) {
      where.createdAt = {}
      if (opts.from) where.createdAt.gte = opts.from
      if (opts.to) where.createdAt.lte = opts.to
    }

    const groups = await prisma.agentOutcome.groupBy({
      by: ['workspace', 'outcomeType'],
      where,
      _count: { id: true },
      _sum: { metricValue: true },
      orderBy: [{ workspace: 'asc' }, { outcomeType: 'asc' }],
    })

    return groups.map(g => ({
      workspace: g.workspace,
      outcomeType: g.outcomeType,
      count: g._count.id,
      metricSum: g._sum.metricValue || 0,
    }))
  }

  /**
   * 企业视角：指定组织在某时间窗内的结果明细（最新 N 条）
   */
  async listByOrganization(organizationId: string, limit = 50): Promise<any[]> {
    return prisma.agentOutcome.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}

export const outcomeRegistry = new OutcomeRegistry()
