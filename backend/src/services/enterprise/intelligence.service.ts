/**
 * IntelligenceService — AI 招聘经理 Intelligence Layer
 *
 * 职责：
 *   1. 通过 RecruitmentContextBuilder 获取结构化招聘上下文
 *   2. 通过 AgentExecutor 调用 LLM 生成 Intelligence Report
 *   3. 输出结构化报告（摘要/风险/行动），附带数据来源标记
 *
 * 架构约束：
 *   - 不直接查询数据库（通过 ContextBuilder）
 *   - 不直接调用 LLM（通过 AgentExecutor → Gateway）
 *   - 输出结构化 JSON，不可控文本
 *   - 每条结论必须附带 source 标记
 */

import type { PrismaClient } from '@prisma/client'
import { RecruitmentContextBuilder, type RecruitmentContext } from './recruitment-context-builder'
import { AgentExecutorImpl } from '../../agent-runtime/brain/agent-executor'

export interface IntelligenceReport {
  generatedAt: string
  agentId: string
  agentName: string
  tenantId: string
  summary: RiskItem[]
  risks: RiskItem[]
  actions: ActionItem[]
  dataSources: string[]
  metadata: {
    model: string
    tokensUsed: number
    durationMs: number
    provider: string
  }
}

export interface RiskItem {
  level: 'info' | 'low' | 'medium' | 'high'
  content: string
  sources: string[]
}

export interface ActionItem {
  action: string
  target: string
  reason: string
  sources: string[]
}

export class IntelligenceService {
  private contextBuilder: RecruitmentContextBuilder

  constructor(
    private prisma: PrismaClient,
    private executor: AgentExecutorImpl,
  ) {
    this.contextBuilder = new RecruitmentContextBuilder(prisma)
  }

  /**
   * 生成 Intelligence Report
   *
   * @param tenantId 租户 ID
   * @param userId 真实用户 ID（用于凭证解析）
   * @param agentId AI 招聘经理 Agent Profile ID
   */
  async generateReport(
    tenantId: string,
    userId: string,
    agentId: string,
  ): Promise<IntelligenceReport> {
    const startTime = Date.now()

    // 1. 构建招聘上下文
    const context = await this.contextBuilder.build(tenantId)

    // 2. 组装 LLM Prompt
    const prompt = this.buildPrompt(context)

    // 3. 通过 Agent Executor 调用 LLM（走 Gateway，BYOK）
    const result = await this.executor.execute(
      agentId,
      prompt,
      {
        organizationId: tenantId,
        actorId: userId,
        permissionScope: ['agent:execute', 'agent:read', 'intelligence:generate'],
        userId,
      },
    )

    // 4. 解析 LLM 输出为结构化报告
    const report = this.parseOutput(result.output, {
      agentId,
      agentName: 'AI 招聘经理',
      tenantId,
      dataSources: context.dataSources,
      model: result.model,
      tokensUsed: result.tokensUsed,
      durationMs: result.durationMs,
      generatedAt: new Date().toISOString(),
    })

    // 如果 LLM 输出无法解析为结构化数据，基于上下文数据生成报告
    if (!report.summary.length && !report.risks.length && !report.actions.length) {
      return this.generateStructuredFallback(context, {
        agentId,
        agentName: 'AI 招聘经理',
        tenantId,
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
      })
    }

    return report
  }

  /**
   * 构建 LLM Prompt
   *
   * 要求 LLM 输出严格的 JSON 格式
   */
  private buildPrompt(context: RecruitmentContext): string {
    const ctx = context

    return `你是 AI 招聘经理，负责分析企业招聘状态并生成 Intelligence Report。

## 当前招聘数据

### 岗位 (${ctx.jobs.length} 个)
${ctx.jobs.map(j => `- ${j.title} [${j.status}] ${j.salary ? `薪资: ${j.salary}` : ''} ${j.location ? `地点: ${j.location}` : ''}`).join('\n') || '暂无岗位数据'}

### 候选人匹配 (${ctx.matches.length} 个)
${ctx.matches.slice(0, 10).map(m => `- ${m.candidateName} → ${m.jobTitle} (匹配度: ${m.score}%, 状态: ${m.status})`).join('\n') || '暂无匹配数据'}

### Pipeline (${ctx.pipeline.total} 人)
${Object.entries(ctx.pipeline.byStage).map(([stage, count]) => `- ${stage}: ${count}人`).join('\n') || '暂无 Pipeline 数据'}

### 面试 (${ctx.interviews.total} 场)
${Object.entries(ctx.interviews.byStatus).map(([status, count]) => `- ${status}: ${count}场`).join('\n') || '暂无面试数据'}

### 待审核 (${ctx.reviews.pending} 项)
${ctx.reviews.items.slice(0, 5).map(r => `- ${r.candidateName || '候选人'} → ${r.jobTitle || '岗位'} (优先级: ${r.priority}, 建议: ${r.aiRecommendation})`).join('\n') || '暂无待审核项'}

---

请基于以上数据，严格按以下 JSON 格式输出分析报告：

\`\`\`json
{
  "summary": [
    { "type": "overview", "content": "概述文本", "sources": ["JobPosting:5"] },
    { "type": "metric", "content": "关键指标", "sources": ["CandidateMatch:3"] }
  ],
  "risks": [
    { "level": "medium", "content": "风险描述", "sources": ["RecruitmentPipeline"] }
  ],
  "actions": [
    { "action": "review_candidate", "target": "目标", "reason": "原因", "sources": ["HumanReviewItem"] }
  ]
}
\`\`\`

要求：
1. summary 不超过 3 条，概括当前招聘状态
2. risks 不超过 3 条，基于数据发现风险
3. actions 不超过 5 条，具体可执行
4. 每条必须附带 sources（数据来源标记）
5. 只输出 JSON，不要其他文字`
  }

  /**
   * 解析 LLM 输出为结构化报告
   */
  private parseOutput(
    output: string,
    meta: {
      agentId: string
      agentName: string
      tenantId: string
      dataSources: string[]
      model: string
      tokensUsed: number
      durationMs: number
      generatedAt: string
    },
  ): IntelligenceReport {
    const report: IntelligenceReport = {
      generatedAt: meta.generatedAt,
      agentId: meta.agentId,
      agentName: meta.agentName,
      tenantId: meta.tenantId,
      summary: [],
      risks: [],
      actions: [],
      dataSources: meta.dataSources,
      metadata: {
        model: meta.model,
        tokensUsed: meta.tokensUsed,
        durationMs: meta.durationMs,
        provider: 'gateway',
      },
    }

    try {
      // 尝试提取 JSON 块
      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) ||
                        output.match(/```\s*([\s\S]*?)\s*```/) ||
                        output.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])

        if (Array.isArray(parsed.summary)) {
          report.summary = parsed.summary.map((s: any) => ({
            level: 'info',
            content: String(s.content || s.text || ''),
            sources: Array.isArray(s.sources) ? s.sources : [],
          })).filter((s: RiskItem) => s.content)
        }

        if (Array.isArray(parsed.risks)) {
          report.risks = parsed.risks.map((r: any) => ({
            level: ['info', 'low', 'medium', 'high'].includes(r.level) ? r.level : 'info',
            content: String(r.content || r.text || ''),
            sources: Array.isArray(r.sources) ? r.sources : [],
          })).filter((r: RiskItem) => r.content)
        }

        if (Array.isArray(parsed.actions)) {
          report.actions = parsed.actions.map((a: any) => ({
            action: String(a.action || a.type || ''),
            target: String(a.target || ''),
            reason: String(a.reason || a.content || ''),
            sources: Array.isArray(a.sources) ? a.sources : [],
          })).filter((a: ActionItem) => a.action || a.reason)
        }
      }
    } catch {
      // 解析失败，返回空报告（上层会 fallback）
    }

    return report
  }

  /**
   * Fallback：基于结构化数据直接生成报告
   * 当 LLM 输出无法解析时使用，保证始终有输出
   */
  private generateStructuredFallback(
    context: RecruitmentContext,
    meta: {
      agentId: string
      agentName: string
      tenantId: string
      model: string
      tokensUsed: number
      durationMs: number
    },
  ): IntelligenceReport {
    const summary: RiskItem[] = []
    const risks: RiskItem[] = []
    const actions: ActionItem[] = []

    // Summary
    if (context.jobs.length > 0) {
      const activeJobs = context.jobs.filter(j => j.status === 'published' || j.status === 'active')
      summary.push({
        level: 'info',
        content: `当前有 ${context.jobs.length} 个岗位，其中 ${activeJobs.length} 个正在招聘中`,
        sources: [`JobPosting:${context.jobs.length}`],
      })
    }

    if (context.matches.length > 0) {
      const highScore = context.matches.filter(m => m.score >= 70)
      summary.push({
        level: 'info',
        content: `候选人匹配 ${context.matches.length} 人，其中 ${highScore.length} 人高匹配（≥70分）`,
        sources: [`CandidateMatch:${context.matches.length}`],
      })
    }

    // Risks
    const staleJobs = context.jobs.filter(j => {
      if (!j.createdAt) return false
      const daysSinceCreated = (Date.now() - new Date(j.createdAt).getTime()) / 86400000
      return daysSinceCreated > 7 && (j.status === 'published' || j.status === 'active')
    })
    if (staleJobs.length > 0) {
      risks.push({
        level: 'medium',
        content: `${staleJobs.map(j => j.title).join('、')} 已发布超过7天，建议检查招聘进展`,
        sources: ['JobPosting'],
      })
    }

    if (context.pipeline.total === 0 && context.jobs.length > 0) {
      risks.push({
        level: 'low',
        content: '有岗位但无 Pipeline 候选人，建议启动人才搜索',
        sources: ['JobPosting', 'RecruitmentPipeline'],
      })
    }

    // Actions
    if (context.reviews.pending > 0) {
      actions.push({
        action: 'review_pending',
        target: `${context.reviews.pending} 项待审核`,
        reason: '有候选人等待 HR 审核',
        sources: [`HumanReviewItem:${context.reviews.pending}`],
      })
    }

    const highMatches = context.matches.filter(m => m.score >= 70 && m.status === 'discovered')
    if (highMatches.length > 0) {
      actions.push({
        action: 'contact_candidate',
        target: highMatches.map(m => m.candidateName).join('、'),
        reason: `高匹配候选人（≥70分）待联系`,
        sources: ['CandidateMatch'],
      })
    }

    const scheduledInterviews = context.interviews.byStatus?.scheduled || 0
    if (scheduledInterviews > 0) {
      actions.push({
        action: 'prepare_interview',
        target: `${scheduledInterviews} 场面试`,
        reason: '有面试待进行',
        sources: ['InterviewSession'],
      })
    }

    return {
      generatedAt: new Date().toISOString(),
      agentId: meta.agentId,
      agentName: meta.agentName,
      tenantId: meta.tenantId,
      summary,
      risks,
      actions,
      dataSources: context.dataSources,
      metadata: {
        model: meta.model,
        tokensUsed: meta.tokensUsed,
        durationMs: meta.durationMs,
        provider: 'gateway',
      },
    }
  }
}
