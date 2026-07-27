/**
 * Phase 4-A: Reasoning Runtime
 * 
 * 推理运行时 — LLM 不再直接回答，而是成为推理器。
 * 
 * 核心理念：
 *   LLM 不是知识来源。
 *   LLM 不是数据库。
 *   LLM 不是工具。
 *   LLM 只是 Reasoning Engine。
 * 
 * 流程：
 *   用户问题
 *     → Intent Parser
 *       → Planner
 *         → Knowledge Runtime
 *           → Memory Runtime
 *             → Tool Runtime
 *               → Evidence Builder
 *                 → LLM（负责推理和表达）
 *                   → 最终回答
 */

import type { LLMRequest, LLMResponse, LLMMessage } from '../gateway/llm-gateway'
import type { KnowledgeContext, QueryIntent } from '../runtime/knowledge-runtime'
import type { CareerFit } from '../canonical/schemas'
import { KnowledgeRuntime } from '../runtime/knowledge-runtime'
import { KnowledgeIntelligenceEngine } from '../engine/knowledge-engine'
import { LLMGateway } from '../gateway/llm-gateway'

// ─── Reasoning Context（推理上下文） ───

export interface ReasoningContext {
  // 用户输入
  userMessage: string
  userId?: string
  intent: QueryIntent
  skills?: string[]
  fit?: CareerFit | null
  
  // 知识层
  knowledge: KnowledgeContext | null
  
  // 证据层
  evidence: Evidence[]
  
  // 推理层
  reasoning: {
    steps: ReasoningStep[]
    intermediateConclusions: string[]
  }
  
  // 输出层
  output: StructuredOutput | null
}

export interface Evidence {
  fact: string
  source: string
  confidence: number
  type: 'knowledge' | 'transition' | 'skill_gap' | 'demand' | 'memory'
}

export interface ReasoningStep {
  step: number
  action: string
  input: string
  output: string
  confidence: number
}

export interface StructuredOutput {
  type: 'career_recommendation' | 'career_transition' | 'skill_gap' | 'salary_info' | 'general'
  data: Record<string, unknown>
  confidence: number
  evidence: string[]
  nextActions: string[]
}

// ─── Reasoning Runtime 配置 ───

export interface ReasoningRuntimeConfig {
  gateway: LLMGateway
  knowledgeRuntime: KnowledgeRuntime
  engine: KnowledgeIntelligenceEngine
  options?: {
    maxSteps?: number
    minConfidence?: number
    enableCache?: boolean
  }
}

// ─── Evidence Builder（证据构建器） ───

export class EvidenceBuilder {
  /**
   * 从 KnowledgeContext 构建证据链
   */
  build(knowledge: KnowledgeContext): Evidence[] {
    const evidence: Evidence[] = []

    // 1. 推荐证据
    for (const rec of knowledge.analysis.recommendations) {
      evidence.push({
        fact: `${rec.careerName}: ${rec.score}分 — ${rec.reason}`,
        source: rec.careerId,
        confidence: rec.score / 100,
        type: 'knowledge',
      })
    }

    // 2. 解释链证据
    for (const trace of knowledge.explain.traces) {
      evidence.push({
        fact: trace.conclusion,
        source: 'explain_engine',
        confidence: trace.confidence,
        type: 'knowledge',
      })
    }

    // 3. 检索结果证据
    for (const career of knowledge.retrieval.careers.slice(0, 3)) {
      evidence.push({
        fact: `${career.item.name}: ${career.evidence}`,
        source: career.source,
        confidence: career.score / 100,
        type: 'demand',
      })
    }

    return evidence.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 生成证据摘要（给 LLM 的上下文）
   */
  summarize(evidence: Evidence[]): string {
    const lines: string[] = ['## 知识证据（来自昆仑镜知识库）\n']
    
    const grouped = this.groupByType(evidence)
    
    for (const [type, items] of grouped) {
      lines.push(`### ${this.getTypeLabel(type)}`)
      for (const item of items.slice(0, 3)) {
        lines.push(`- ${item.fact} (置信度: ${Math.round(item.confidence * 100)}%)`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  private groupByType(evidence: Evidence[]): Map<string, Evidence[]> {
    const grouped = new Map<string, Evidence[]>()
    for (const e of evidence) {
      const existing = grouped.get(e.type) || []
      existing.push(e)
      grouped.set(e.type, existing)
    }
    return grouped
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      knowledge: '知识库结论',
      transition: '职业迁移数据',
      skill_gap: '技能缺口分析',
      demand: '市场需求',
      memory: '历史记忆',
    }
    return labels[type] || type
  }
}

// ─── Reasoning Runtime 主类 ───

export class ReasoningRuntime {
  private evidenceBuilder = new EvidenceBuilder()
  private cache = new Map<string, StructuredOutput>()

  constructor(private config: ReasoningRuntimeConfig) {}

  /**
   * 推理主入口
   * 
   * 流程：意图 → 知识检索 → 证据构建 → LLM 推理 → 结构化输出
   */
  async reason(params: {
    userMessage: string
    userId?: string
    intent: QueryIntent
    skills?: string[]
    fit?: CareerFit | null
    knowledge: KnowledgeContext | null
  }): Promise<ReasoningContext> {
    const { userMessage, intent, knowledge, skills, fit } = params

    // 1. 构建证据链
    const evidence = knowledge ? this.evidenceBuilder.build(knowledge) : []

    // 2. 生成证据摘要
    const evidenceSummary = this.evidenceBuilder.summarize(evidence)

    // 3. 构建推理上下文
    const reasoningContext: ReasoningContext = {
      userMessage,
      userId: params.userId,
      intent,
      skills,
      fit,
      knowledge,
      evidence,
      reasoning: { steps: [], intermediateConclusions: [] },
      output: null,
    }

    // 4. 检查缓存
    const cacheKey = this.buildCacheKey(intent, skills || [])
    const cached = this.cache.get(cacheKey)
    if (cached && this.config.options?.enableCache !== false) {
      reasoningContext.output = cached
      return reasoningContext
    }

    // 5. 调用 LLM 进行推理
    const llmResponse = await this.callLLM(userMessage, evidenceSummary, intent)

    // 6. 解析结构化输出
    const output = this.parseStructuredOutput(llmResponse, evidence)
    reasoningContext.output = output

    // 7. 缓存结果
    this.cache.set(cacheKey, output)

    return reasoningContext
  }

  /**
   * 调用 LLM 进行推理
   */
  private async callLLM(
    userMessage: string,
    evidenceSummary: string,
    intent: QueryIntent,
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(intent),
      },
      {
        role: 'user',
        content: `${evidenceSummary}\n\n---\n\n## 用户问题\n${userMessage}`,
      },
    ]

    const request: LLMRequest = {
      messages,
      taskType: intent.type,
      maxTokens: 2000,
      temperature: 0.3, // 低温度，更确定性
    }

    return this.config.gateway.call(request)
  }

  /**
   * 获取 System Prompt（根据意图类型）
   */
  private getSystemPrompt(intent: QueryIntent): string {
    const basePrompt = `你是昆仑镜 AI 职业顾问的推理引擎。

你的职责：
1. 基于昆仑镜知识库提供的证据进行推理
2. 不要编造任何知识库中没有的信息
3. 每个结论必须引用具体的证据
4. 输出结构化 JSON 格式

你不是知识来源。你不是数据库。你不是工具。你只是推理引擎。`

    switch (intent.type) {
      case 'career_recommendation':
        return basePrompt + `

当前任务：职业推荐
请根据证据中的职业适配度分数、能力画像匹配度和市场需求，为用户推荐最适合的职业。
输出格式：包含推荐职业列表、每个职业的评分和推荐理由。`

      case 'career_transition':
        return basePrompt + `

当前任务：职业迁移分析
请根据证据中的迁移路径、成功率和技能缺口，分析从当前职业到目标职业的可行性。
输出格式：包含迁移难度、预计时间、成功率和关键技能缺口。`

      case 'skill_gap':
        return basePrompt + `

当前任务：技能缺口分析
请根据证据中的技能要求，分析用户当前技能与目标职业的差距。
输出格式：包含缺失技能列表、优先级排序和学习建议。`

      default:
        return basePrompt + `

当前任务：综合职业咨询
请根据知识库证据，回答用户的职业问题。
输出格式：包含结论、证据引用和建议行动。`
    }
  }

  /**
   * 解析 LLM 输出为结构化格式
   */
  private parseStructuredOutput(llmResponse: LLMResponse, evidence: Evidence[]): StructuredOutput {
    const content = llmResponse.content

    // 尝试解析 JSON
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1] || jsonMatch[0])
        return {
          type: data.type || 'general',
          data: data,
          confidence: data.confidence || 0.7,
          evidence: data.evidence || evidence.slice(0, 3).map(e => e.fact),
          nextActions: data.nextActions || [],
        }
      }
    } catch {
      // JSON 解析失败，使用文本输出
    }

    // 回退：从文本中提取信息
    return {
      type: 'general',
      data: { rawContent: content },
      confidence: 0.5,
      evidence: evidence.slice(0, 3).map(e => e.fact),
      nextActions: [],
    }
  }

  private buildCacheKey(intent: QueryIntent, skills: string[]): string {
    return `${intent.type}:${skills.sort().join(',')}`
  }
}

// ─── Structured Output Builder（结构化输出生成器） ───

export class StructuredOutputBuilder {
  /**
   * 生成标准推荐输出
   */
  buildRecommendationOutput(params: {
    recommendations: Array<{ name: string; score: number; reason: string }>
    evidence: string[]
    nextActions: string[]
  }): StructuredOutput {
    return {
      type: 'career_recommendation',
      data: {
        recommendations: params.recommendations,
        generatedAt: Date.now(),
      },
      confidence: params.recommendations[0]?.score / 100 || 0.5,
      evidence: params.evidence,
      nextActions: params.nextActions,
    }
  }

  /**
   * 生成迁移分析输出
   */
  buildTransitionOutput(params: {
    fromCareer: string
    toCareer: string
    difficulty: number
    successRate: number
    estimatedMonths: number
    keyGaps: string[]
    evidence: string[]
  }): StructuredOutput {
    return {
      type: 'career_transition',
      data: params,
      confidence: params.successRate / 100,
      evidence: params.evidence,
      nextActions: ['制定学习计划', '查看学习资源', '了解薪资变化'],
    }
  }

  /**
   * 生成技能缺口输出
   */
  buildSkillGapOutput(params: {
    targetCareer: string
    gaps: Array<{ name: string; priority: string; timeToLearn: string }>
    readiness: number
    evidence: string[]
  }): StructuredOutput {
    return {
      type: 'skill_gap',
      data: params,
      confidence: params.readiness / 100,
      evidence: params.evidence,
      nextActions: ['推荐学习资源', '制定学习计划', '查看相关职业'],
    }
  }
}
