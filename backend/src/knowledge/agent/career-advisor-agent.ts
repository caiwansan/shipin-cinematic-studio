/**
 * Phase 3-D: CareerAdvisorAgent
 * 
 * 职业顾问 Agent — 聊天正式从 State Machine 升级成 Agent。
 * 
 * 完整链路：
 *   用户
 *     → CareerAdvisorAgent
 *       → Knowledge Runtime (6个运行时)
 *         → Knowledge Engine (5个推理引擎)
 *           → Tool Router
 *             → Memory
 *               → LLM (未来)
 *                 → 回答
 */

import type { CareerFit } from '../canonical/schemas'
import { KnowledgeRuntime, QueryIntent, KnowledgeContext, TaskPlan, MemorySnippet } from '../runtime/knowledge-runtime'
import { KnowledgeIntelligenceEngine } from '../engine/knowledge-engine'
import { getCareerRepository } from '../repository/careers/career-repository'
import { getSkillRepository } from '../repository/skills/skill-repository'

// ─── Agent 输入/输出 ───

export interface AgentRequest {
  userMessage: string
  userId?: string
  sessionHistory?: AgentMemoryEntry[]
}

export interface AgentResponse {
  message: string          // 给用户的回复
  context: KnowledgeContext | null
  plan: TaskPlan | null
  suggestedActions: string[]
  metadata: {
    processingTimeMs: number
    cacheHit: boolean
    confidence: number
  }
}

export interface AgentMemoryEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// ─── Intent Parser（意图识别） ───

export class IntentParser {
  /**
   * 从用户消息中解析意图
   */
  parse(message: string): QueryIntent {
    const msg = message.toLowerCase()

    // 职业推荐
    if (this.matchAny(msg, ['推荐', '适合', '建议', '方向', '选择'])) {
      return { type: 'career_recommendation' }
    }

    // 职业迁移
    if (this.matchAny(msg, ['转行', '转型', '转', '切换', '迁移', '换'])) {
      return { type: 'career_transition' }
    }

    // 技能差距
    if (this.matchAny(msg, ['缺口', '差距', '不会', '缺', '补', '学什么'])) {
      return { type: 'skill_gap' }
    }

    // 薪资查询
    if (this.matchAny(msg, ['薪资', '工资', '薪水', '收入', '多少钱'])) {
      return { type: 'salary_query' }
    }

    // 职业详情
    if (this.matchAny(msg, ['详情', '介绍', '是什么', '做什么', '怎么样'])) {
      return { type: 'career_detail' }
    }

    return { type: 'general_explain' }
  }

  /**
   * 提取关键词
   */
  extractKeywords(message: string): string[] {
    const keywords: string[] = []
    const msg = message.toLowerCase()

    // 常见技能/职业关键词
    const skillKeywords = [
      'vue', 'react', 'angular', 'typescript', 'javascript', 'node', 'nodejs',
      'python', 'java', 'go', 'rust', 'sql', 'docker', 'kubernetes',
      'ai', 'llm', 'gpt', 'langchain', 'rag', 'prompt',
      '前端', '后端', '全栈', '测试', '运维', '产品', '设计',
      '新媒体', '短视频', '剪辑', '编剧', '导演',
      '深圳', '北京', '上海', '广州', '杭州',
    ]

    for (const kw of skillKeywords) {
      if (msg.includes(kw)) {
        keywords.push(kw)
      }
    }

    return keywords
  }

  private matchAny(msg: string, keywords: string[]): boolean {
    return keywords.some(kw => msg.includes(kw))
  }
}

// ─── Response Builder（回复构建器） ───

export class ResponseBuilder {
  /**
   * 根据 KnowledgeContext 构建自然语言回复
   */
  build(context: KnowledgeContext, intent: QueryIntent): string {
    switch (intent.type) {
      case 'career_recommendation':
        return this.buildRecommendationResponse(context)
      case 'career_transition':
        return this.buildTransitionResponse(context)
      case 'skill_gap':
        return this.buildSkillGapResponse(context)
      case 'salary_query':
        return this.buildSalaryResponse(context)
      case 'career_detail':
        return this.buildDetailResponse(context)
      default:
        return this.buildGeneralResponse(context)
    }
  }

  private buildRecommendationResponse(context: KnowledgeContext): string {
    const recs = context.analysis.recommendations
    if (recs.length === 0) return '暂无推荐职业。'

    const lines = ['## 🎯 职业推荐\n']

    for (let i = 0; i < Math.min(5, recs.length); i++) {
      const rec = recs[i]
      const bar = '█'.repeat(Math.round(rec.score / 5)) + '░'.repeat(20 - Math.round(rec.score / 5))
      lines.push(`${i + 1}. **${rec.careerName}** ${bar} ${rec.score}分`)
      lines.push(`   ${rec.reason}`)
      if (rec.evidence.length > 0) {
        lines.push(`   📎 ${rec.evidence[0]}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  private buildTransitionResponse(context: KnowledgeContext): string {
    const traces = context.explain.traces
    if (traces.length === 0) return '暂无迁移分析。'

    const lines = ['## 🔄 职业迁移分析\n']
    for (const trace of traces.slice(0, 3)) {
      lines.push(`**${trace.conclusion}**`)
      for (const ev of trace.evidence) {
        lines.push(`- 📎 ${ev}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  private buildSkillGapResponse(context: KnowledgeContext): string {
    return '## 📊 技能缺口分析\n\n' +
      '（分析结果将在此展示）\n'
  }

  private buildSalaryResponse(context: KnowledgeContext): string {
    return '## 💰 薪资参考\n\n' +
      '（薪资数据将在此展示）\n'
  }

  private buildDetailResponse(context: KnowledgeContext): string {
    return '## 📋 职业详情\n\n' +
      '（详细信息将在此展示）\n'
  }

  private buildGeneralResponse(context: KnowledgeContext): string {
    const recs = context.analysis.recommendations
    if (recs.length > 0) {
      return this.buildRecommendationResponse(context)
    }
    return '你好！我是昆仑镜职业顾问，可以帮你分析职业方向、技能缺口、薪资水平等。\n\n请告诉我你的技能和目标，我来为你分析。'
  }
}

// ─── CareerAdvisorAgent ★ ───

export class CareerAdvisorAgent {
  private runtime: KnowledgeRuntime
  private engine: KnowledgeIntelligenceEngine
  private intentParser = new IntentParser()
  private responseBuilder = new ResponseBuilder()

  private userProfiles = new Map<string, { skills: string[]; fit: CareerFit | null }>()

  constructor() {
    const careerRepo = getCareerRepository()
    const skillRepo = getSkillRepository()

    this.engine = new KnowledgeIntelligenceEngine({
      careerRepo: careerRepo as any,
      skillRepo: skillRepo as any,
    })

    this.runtime = new KnowledgeRuntime({
      careerRepo: careerRepo as any,
      skillRepo: skillRepo as any,
      engine: this.engine,
    })
  }

  /**
   * 处理用户消息（主入口）
   * 
   * 链路：消息 → 意图 → 规划 → 检索 → 分析 → 上下文 → 解释 → 回复
   */
  async handleMessage(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()

    // 1. 意图识别
    const intent = this.intentParser.parse(request.userMessage)
    const keywords = this.intentParser.extractKeywords(request.userMessage)

    // 2. 获取用户画像
    const profile = this.getUserProfile(request.userId || 'default')

    // 3. 处理查询（通过 Knowledge Runtime）
    const context = await this.runtime.processQuery({
      userSkills: profile.skills,
      userFit: profile.fit,
      intent,
      keywords,
      memory: this.buildMemory(request.sessionHistory),
    })

    // 4. 生成任务计划
    const plan = this.runtime.planTask(intent, context)

    // 5. 构建回复
    const message = this.responseBuilder.build(context, intent)

    // 6. 生成建议操作
    const suggestedActions = this.generateSuggestedActions(intent, context)

    return {
      message,
      context,
      plan,
      suggestedActions,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        cacheHit: context.meta.cacheHit,
        confidence: context.explain.confidence,
      },
    }
  }

  /**
   * 设置用户画像
   */
  setUserProfile(userId: string, skills: string[], fit: CareerFit | null): void {
    this.userProfiles.set(userId, { skills, fit })
  }

  /**
   * 获取运行时统计
   */
  getRuntimeStats() {
    return {
      cache: this.runtime.cache.stats(),
      userProfiles: this.userProfiles.size,
    }
  }

  // ─── 私有方法 ───

  private getUserProfile(userId: string): { skills: string[]; fit: CareerFit | null } {
    return this.userProfiles.get(userId) || {
      skills: [],
      fit: null,
    }
  }

  private buildMemory(history?: AgentMemoryEntry[]): MemorySnippet[] {
    if (!history) return []
    return history.slice(-5).map(entry => ({
      type: entry.role,
      content: entry.content,
      timestamp: entry.timestamp,
    }))
  }

  private generateSuggestedActions(intent: QueryIntent, context: KnowledgeContext): string[] {
    const actions: string[] = []

    switch (intent.type) {
      case 'career_recommendation':
        actions.push('查看推荐详情')
        actions.push('分析技能差距')
        actions.push('了解薪资水平')
        break
      case 'career_transition':
        actions.push('查看学习路线')
        actions.push('分析技能缺口')
        actions.push('了解目标薪资')
        break
      case 'skill_gap':
        actions.push('推荐学习资源')
        actions.push('查看相关职业')
        actions.push('制定学习计划')
        break
      default:
        actions.push('技能评估')
        actions.push('职业推荐')
        actions.push('薪资查询')
    }

    return actions
  }
}

// ─── 单例 ───

let agentInstance: CareerAdvisorAgent | null = null

export function getCareerAdvisorAgent(): CareerAdvisorAgent {
  if (!agentInstance) {
    agentInstance = new CareerAdvisorAgent()
  }
  return agentInstance
}
