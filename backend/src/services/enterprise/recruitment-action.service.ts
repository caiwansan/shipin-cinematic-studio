/**
 * RecruitmentActionService — AI 招聘官 Copilot Action Layer
 *
 * KM-AI-JOB-AGENT-05: 从 Intelligence 转 Action
 *
 * 职责：
 *   1. 候选人分析（读取 CandidateMatch / Pipeline / Interview 数据，生成评价和建议）
 *   2. 沟通内容生成（首轮邀约、面试提醒、拒绝反馈、Offer沟通）
 *   3. 面试邀约建议（基于 Pipeline 状态和匹配度）
 *   4. Pipeline 推进建议（基于当前 stage 和候选人状态）
 *
 * 架构约束（掌柜批准的 L1 范围）：
 *   - 第一阶段只做辅助执行（建议行动），不自动修改招聘状态
 *   - 不新增招聘业务模型
 *   - 所有动作经过 Action Layer
 *   - 不直接查询数据库（通过 RecruitmentContextBuilder）
 *   - 不直接调用 LLM（通过 AgentExecutor → Gateway）
 *   - 所有输出附带数据来源标记
 */

import type { PrismaClient } from '@prisma/client'
import { RecruitmentContextBuilder } from './recruitment-context-builder'
import { AgentExecutorImpl } from '../../agent-runtime/brain/agent-executor'

// ─── 类型定义 ────────────────────────────────────────────────────

export type ActionType =
  | 'candidate_analysis'   // 候选人分析
  | 'communication_draft'  // 沟通内容生成
  | 'interview_suggestion' // 面试邀约建议
  | 'pipeline_suggestion'  // Pipeline 推进建议

export type CommunicationType =
  | 'initial_outreach'    // 首轮邀约
  | 'interview_invite'    // 面试邀约
  | 'interview_reminder'  // 面试提醒
  | 'rejection_feedback'  // 拒绝反馈
  | 'offer_negotiation'   // Offer 沟通

export interface ActionResult {
  type: ActionType
  generatedAt: string
  agentId: string
  agentName: string
  tenantId: string
  dataSources: string[]
  content: CandidateAnalysisResult | CommunicationResult | InterviewSuggestionResult | PipelineSuggestionResult
  metadata: {
    model: string
    tokensUsed: number
    durationMs: number
    provider: string
  }
}

export interface CandidateAnalysisResult {
  analysisType: 'candidate_analysis'
  candidateName: string
  jobTitle: string
  overallRating: 'recommend' | 'consider' | 'pass'
  strengths: string[]
  risks: string[]
  suggestions: string[]
  nextStep: string
  sources: string[]
}

export interface CommunicationResult {
  analysisType: 'communication_draft'
  communicationType: CommunicationType
  subject: string
  body: string
  tone: string
  sources: string[]
}

export interface InterviewSuggestionResult {
  analysisType: 'interview_suggestion'
  candidateName: string
  jobTitle: string
  suggested: boolean
  reason: string
  recommendedRound: string
  focusAreas: string[]
  sources: string[]
}

export interface PipelineSuggestionResult {
  analysisType: 'pipeline_suggestion'
  candidateName: string
  jobTitle: string
  currentStage: string
  suggestedStage: string | null
  reason: string
  sources: string[]
}

// ─── RecruitmentActionService ─────────────────────────────────────

export class RecruitmentActionService {
  private contextBuilder: RecruitmentContextBuilder

  constructor(
    private prisma: PrismaClient,
    private executor: AgentExecutorImpl,
  ) {
    this.contextBuilder = new RecruitmentContextBuilder(prisma)
  }

  // ─── 1. 候选人分析 ─────────────────────────────────────────────

  async analyzeCandidate(
    tenantId: string,
    userId: string,
    agentId: string,
    candidateName: string,
  ): Promise<ActionResult> {
    const startTime = Date.now()
    const context = await this.contextBuilder.build(tenantId)

    // 找到匹配的候选人
    const candidateMatch = context.matches.find(
      m => m.candidateName.includes(candidateName) || candidateName.includes(m.candidateName)
    )

    const pipelineItem = context.pipeline.recentActivity.find(
      p => p.candidateName.includes(candidateName) || candidateName.includes(p.candidateName)
    )

    const prompt = this.buildCandidateAnalysisPrompt(candidateName, candidateMatch, pipelineItem, context)
    const result = await this.executor.execute(agentId, prompt, {
      organizationId: tenantId,
      actorId: userId,
      permissionScope: ['agent:execute', 'agent:read', 'action:analyze'],
      userId,
    })

    const content = this.parseCandidateAnalysisOutput(result.output, candidateName, candidateMatch?.jobTitle || '未知岗位')

    return {
      type: 'candidate_analysis',
      generatedAt: new Date().toISOString(),
      agentId,
      agentName: 'AI 招聘官',
      tenantId,
      dataSources: context.dataSources,
      content,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  // ─── 2. 沟通内容生成 ───────────────────────────────────────────

  async generateCommunication(
    tenantId: string,
    userId: string,
    agentId: string,
    commType: CommunicationType,
    candidateName: string,
    jobTitle?: string,
  ): Promise<ActionResult> {
    const startTime = Date.now()
    const context = await this.contextBuilder.build(tenantId)

    const prompt = this.buildCommunicationPrompt(commType, candidateName, jobTitle, context)
    const result = await this.executor.execute(agentId, prompt, {
      organizationId: tenantId,
      actorId: userId,
      permissionScope: ['agent:execute', 'agent:read', 'action:communicate'],
      userId,
    })

    const content = this.parseCommunicationOutput(result.output, commType)

    return {
      type: 'communication_draft',
      generatedAt: new Date().toISOString(),
      agentId,
      agentName: 'AI 招聘官',
      tenantId,
      dataSources: context.dataSources,
      content,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  // ─── 3. 面试邀约建议 ───────────────────────────────────────────

  async suggestInterview(
    tenantId: string,
    userId: string,
    agentId: string,
    candidateName: string,
  ): Promise<ActionResult> {
    const startTime = Date.now()
    const context = await this.contextBuilder.build(tenantId)

    const candidateMatch = context.matches.find(
      m => m.candidateName.includes(candidateName) || candidateName.includes(m.candidateName)
    )
    const pipelineItem = context.pipeline.recentActivity.find(
      p => p.candidateName.includes(candidateName) || candidateName.includes(p.candidateName)
    )

    const prompt = this.buildInterviewSuggestionPrompt(candidateName, candidateMatch, pipelineItem, context)
    const result = await this.executor.execute(agentId, prompt, {
      organizationId: tenantId,
      actorId: userId,
      permissionScope: ['agent:execute', 'agent:read', 'action:interview'],
      userId,
    })

    const content = this.parseInterviewSuggestionOutput(result.output, candidateName, candidateMatch?.jobTitle || '未知岗位')

    return {
      type: 'interview_suggestion',
      generatedAt: new Date().toISOString(),
      agentId,
      agentName: 'AI 招聘官',
      tenantId,
      dataSources: context.dataSources,
      content,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  // ─── 4. Pipeline 推进建议 ──────────────────────────────────────

  async suggestPipelineMove(
    tenantId: string,
    userId: string,
    agentId: string,
    candidateName: string,
  ): Promise<ActionResult> {
    const startTime = Date.now()
    const context = await this.contextBuilder.build(tenantId)

    const pipelineItem = context.pipeline.recentActivity.find(
      p => p.candidateName.includes(candidateName) || candidateName.includes(p.candidateName)
    )
    const candidateMatch = context.matches.find(
      m => m.candidateName.includes(candidateName) || candidateName.includes(m.candidateName)
    )

    const prompt = this.buildPipelineSuggestionPrompt(candidateName, pipelineItem, candidateMatch, context)
    const result = await this.executor.execute(agentId, prompt, {
      organizationId: tenantId,
      actorId: userId,
      permissionScope: ['agent:execute', 'agent:read', 'action:pipeline'],
      userId,
    })

    const content = this.parsePipelineSuggestionOutput(result.output, candidateName, pipelineItem?.stage || 'unknown')

    return {
      type: 'pipeline_suggestion',
      generatedAt: new Date().toISOString(),
      agentId,
      agentName: 'AI 招聘官',
      tenantId,
      dataSources: context.dataSources,
      content,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  // ─── Prompt 构建 ───────────────────────────────────────────────

  private buildCandidateAnalysisPrompt(
    candidateName: string,
    candidateMatch: any,
    pipelineItem: any,
    context: any,
  ): string {
    const matchInfo = candidateMatch
      ? `匹配岗位: ${candidateMatch.jobTitle}\n匹配度: ${candidateMatch.score}%\n匹配状态: ${candidateMatch.status}`
      : '无匹配数据'

    const pipelineInfo = pipelineItem
      ? `Pipeline 阶段: ${pipelineItem.stage}\n最后活跃: ${pipelineItem.lastActivityAt}`
      : '无 Pipeline 数据'

    return `你是 AI 招聘官，负责分析候选人并给出招聘建议。

## 候选人信息
姓名: ${candidateName}
${matchInfo}
${pipelineInfo}

## 企业招聘背景
当前在招岗位: ${context.jobs.length} 个
候选人匹配总数: ${context.matches.length} 人
Pipeline 总数: ${context.pipeline.total} 人
待审核: ${context.reviews.pending} 项

请基于以上数据，分析该候选人并严格按以下 JSON 格式输出：

\`\`\`json
{
  "analysisType": "candidate_analysis",
  "candidateName": "${candidateName}",
  "jobTitle": "${candidateMatch?.jobTitle || '未知岗位'}",
  "overallRating": "recommend|consider|pass",
  "strengths": ["优势1", "优势2"],
  "risks": ["风险1"],
  "suggestions": ["建议1", "建议2"],
  "nextStep": "下一步行动建议",
  "sources": ["CandidateMatch", "RecruitmentPipeline"]
}
\`\`\`

要求：
1. overallRating: recommend（推荐）/ consider（待定）/ pass（不推荐）
2. strengths 和 risks 各不超过 3 条，基于数据
3. suggestions 不超过 3 条，具体可执行
4. nextStep 一句话概括
5. 只输出 JSON，不要其他文字`
  }

  private buildCommunicationPrompt(
    commType: CommunicationType,
    candidateName: string,
    jobTitle: string | undefined,
    context: any,
  ): string {
    const typeLabel: Record<CommunicationType, string> = {
      initial_outreach: '首轮邀约消息',
      interview_invite: '面试邀约',
      interview_reminder: '面试提醒',
      rejection_feedback: '拒绝反馈',
      offer_negotiation: 'Offer 沟通',
    }

    const toneGuide: Record<CommunicationType, string> = {
      initial_outreach: '友好、专业、简洁，介绍岗位亮点',
      interview_invite: '正式、尊重、明确时间地点',
      interview_reminder: '友好、提醒、确认参加',
      rejection_feedback: '尊重、感谢、鼓励',
      offer_negotiation: '热情、专业、清晰',
    }

    return `你是 AI 招聘官，负责为企业生成候选人沟通内容。

## 沟通类型
${typeLabel[commType]}

## 候选人
姓名: ${candidateName}
${jobTitle ? `目标岗位: ${jobTitle}` : `当前岗位: ${context.jobs.map((j: any) => j.title).join(', ') || '未知'}`}

## 语气要求
${toneGuide[commType]}

## 企业背景
当前在招岗位: ${context.jobs.length} 个
Pipeline 候选人: ${context.pipeline.total} 人

请生成沟通内容，严格按以下 JSON 格式输出：

\`\`\`json
{
  "analysisType": "communication_draft",
  "communicationType": "${commType}",
  "subject": "消息主题/标题",
  "body": "消息正文（200字以内）",
  "tone": "语气描述",
  "sources": ["JobPosting", "CandidateMatch"]
}
\`\`\`

要求：
1. 正文 200 字以内，简洁专业
2. 不包含具体薪资数字（除非已知）
3. 中文输出
4. 只输出 JSON，不要其他文字`
  }

  private buildInterviewSuggestionPrompt(
    candidateName: string,
    candidateMatch: any,
    pipelineItem: any,
    context: any,
  ): string {
    const matchInfo = candidateMatch
      ? `匹配岗位: ${candidateMatch.jobTitle}\n匹配度: ${candidateMatch.score}%`
      : '无匹配数据'

    const pipelineInfo = pipelineItem
      ? `当前 Pipeline 阶段: ${pipelineItem.stage}`
      : '无 Pipeline 数据'

    return `你是 AI 招聘官，负责评估候选人是否应进入面试环节。

## 候选人信息
姓名: ${candidateName}
${matchInfo}
${pipelineInfo}

## 企业招聘背景
当前在招岗位: ${context.jobs.length} 个
Pipeline 总数: ${context.pipeline.total} 人
已完成面试: ${context.interviews.byStatus?.completed || 0} 场

请评估是否建议安排面试，严格按以下 JSON 格式输出：

\`\`\`json
{
  "analysisType": "interview_suggestion",
  "candidateName": "${candidateName}",
  "jobTitle": "${candidateMatch?.jobTitle || '未知岗位'}",
  "suggested": true|false,
  "reason": "建议/不建议的原因",
  "recommendedRound": "初面|技术面|行为面|终面",
  "focusAreas": ["重点考察领域1", "重点考察领域2"],
  "sources": ["CandidateMatch", "RecruitmentPipeline"]
}
\`\`\`

要求：
1. suggested: true（建议面试）/ false（不建议）
2. reason 基于匹配度和 Pipeline 状态
3. focusAreas 不超过 3 个
4. 只输出 JSON，不要其他文字`
  }

  private buildPipelineSuggestionPrompt(
    candidateName: string,
    pipelineItem: any,
    candidateMatch: any,
    context: any,
  ): string {
    const pipelineInfo = pipelineItem
      ? `当前阶段: ${pipelineItem.stage}\n岗位: ${pipelineItem.jobTitle}\n最后活跃: ${pipelineItem.lastActivityAt}`
      : '无 Pipeline 数据'

    const matchInfo = candidateMatch
      ? `匹配度: ${candidateMatch.score}%`
      : ''

    const stageOptions = ['discovered', 'screening', 'interview', 'offer', 'hired', 'rejected']

    return `你是 AI 招聘官，负责建议 Pipeline 候选人是否推进到下一阶段。

## 候选人信息
姓名: ${candidateName}
${pipelineInfo}
${matchInfo}

## Pipeline 阶段说明
discovered → screening → interview → offer → hired
                   ↘ rejected

## 企业招聘背景
Pipeline 分布: ${Object.entries(context.pipeline.byStage).map(([s, c]) => `${s}:${c}人`).join(', ') || '无'}

请评估是否建议推进 Pipeline，严格按以下 JSON 格式输出：

\`\`\`json
{
  "analysisType": "pipeline_suggestion",
  "candidateName": "${candidateName}",
  "jobTitle": "${pipelineItem?.jobTitle || candidateMatch?.jobTitle || '未知岗位'}",
  "currentStage": "${pipelineItem?.stage || 'unknown'}",
  "suggestedStage": "下一阶段或 null（不建议推进）",
  "reason": "推进/不推进的原因",
  "sources": ["RecruitmentPipeline", "CandidateMatch"]
}
\`\`\`

要求：
1. suggestedStage 为 null 表示不建议推进
2. 如建议推进，必须是当前阶段的下一个合理阶段
3. reason 基于数据和 Pipeline 状态
4. ⚠️ 注意：这只是建议，不会自动修改 Pipeline
5. 只输出 JSON，不要其他文字`
  }

  // ─── 输出解析 ─────────────────────────────────────────────────

  private parseCandidateAnalysisOutput(output: string, candidateName: string, jobTitle: string): CandidateAnalysisResult {
    const fallback: CandidateAnalysisResult = {
      analysisType: 'candidate_analysis',
      candidateName,
      jobTitle,
      overallRating: 'consider',
      strengths: ['候选人数据已录入系统'],
      risks: [],
      suggestions: ['建议进一步了解候选人背景'],
      nextStep: '安排初步沟通',
      sources: ['CandidateMatch'],
    }

    try {
      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) ||
                        output.match(/```\s*([\s\S]*?)\s*```/) ||
                        output.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return fallback

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      return {
        analysisType: 'candidate_analysis',
        candidateName: String(parsed.candidateName || candidateName),
        jobTitle: String(parsed.jobTitle || jobTitle),
        overallRating: ['recommend', 'consider', 'pass'].includes(parsed.overallRating) ? parsed.overallRating : 'consider',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 3) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
        nextStep: String(parsed.nextStep || '建议进一步了解候选人'),
        sources: Array.isArray(parsed.sources) ? parsed.sources : ['CandidateMatch'],
      }
    } catch {
      return fallback
    }
  }

  private parseCommunicationOutput(output: string, commType: CommunicationType): CommunicationResult {
    const fallback: CommunicationResult = {
      analysisType: 'communication_draft',
      communicationType: commType,
      subject: '沟通消息',
      body: '您好，我们已收到您的简历，期待与您进一步沟通。',
      tone: '专业友好',
      sources: ['JobPosting'],
    }

    try {
      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) ||
                        output.match(/```\s*([\s\S]*?)\s*```/) ||
                        output.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return fallback

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      return {
        analysisType: 'communication_draft',
        communicationType: commType,
        subject: String(parsed.subject || '沟通消息'),
        body: String(parsed.body || fallback.body),
        tone: String(parsed.tone || '专业友好'),
        sources: Array.isArray(parsed.sources) ? parsed.sources : ['JobPosting'],
      }
    } catch {
      return fallback
    }
  }

  private parseInterviewSuggestionOutput(output: string, candidateName: string, jobTitle: string): InterviewSuggestionResult {
    const fallback: InterviewSuggestionResult = {
      analysisType: 'interview_suggestion',
      candidateName,
      jobTitle,
      suggested: false,
      reason: '数据不足，无法评估',
      recommendedRound: '初面',
      focusAreas: [],
      sources: ['CandidateMatch'],
    }

    try {
      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) ||
                        output.match(/```\s*([\s\S]*?)\s*```/) ||
                        output.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return fallback

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      return {
        analysisType: 'interview_suggestion',
        candidateName: String(parsed.candidateName || candidateName),
        jobTitle: String(parsed.jobTitle || jobTitle),
        suggested: Boolean(parsed.suggested),
        reason: String(parsed.reason || '数据不足'),
        recommendedRound: String(parsed.recommendedRound || '初面'),
        focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 3) : [],
        sources: Array.isArray(parsed.sources) ? parsed.sources : ['CandidateMatch'],
      }
    } catch {
      return fallback
    }
  }

  private parsePipelineSuggestionOutput(output: string, candidateName: string, currentStage: string): PipelineSuggestionResult {
    const fallback: PipelineSuggestionResult = {
      analysisType: 'pipeline_suggestion',
      candidateName,
      jobTitle: '未知岗位',
      currentStage,
      suggestedStage: null,
      reason: '数据不足，暂不建议推进',
      sources: ['RecruitmentPipeline'],
    }

    try {
      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) ||
                        output.match(/```\s*([\s\S]*?)\s*```/) ||
                        output.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return fallback

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      return {
        analysisType: 'pipeline_suggestion',
        candidateName: String(parsed.candidateName || candidateName),
        jobTitle: String(parsed.jobTitle || '未知岗位'),
        currentStage: String(parsed.currentStage || currentStage),
        suggestedStage: parsed.suggestedStage || null,
        reason: String(parsed.reason || '数据不足'),
        sources: Array.isArray(parsed.sources) ? parsed.sources : ['RecruitmentPipeline'],
      }
    } catch {
      return fallback
    }
  }
}
