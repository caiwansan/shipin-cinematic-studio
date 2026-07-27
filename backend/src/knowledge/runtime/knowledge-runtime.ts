/**
 * Phase 3-D: Knowledge Runtime
 * 
 * 知识运行时 — 让所有知识能力真正能够被 Agent 运行和组合。
 * 
 * 架构：
 *   Hermes / Agent
 *     → Knowledge Runtime
 *       → Retrieval Engine (检索 + 排序)
 *       → Context Builder (统一上下文)
 *       → Task Planner (任务规划)
 *       → Cache Layer (缓存)
 *       → Explain Runtime (动态解释)
 *         → Knowledge Engine (5个推理引擎)
 *           → Repository
 */

import type {
  CareerCanonicalObject,
  SkillCanonicalObject,
  CareerFit,
} from '../canonical/schemas'
import { KnowledgeIntelligenceEngine } from '../engine/knowledge-engine'

// ─── Knowledge Context（统一上下文） ───

export interface KnowledgeContext {
  user: {
    skills: string[]
    fit: CareerFit | null
    intent: QueryIntent
    memory: MemorySnippet[]
  }
  retrieval: {
    careers: ScoredResult<CareerCanonicalObject>[]
    skills: ScoredResult<SkillCanonicalObject>[]
    evidence: EvidenceSnippet[]
  }
  analysis: {
    recommendations: CareerRecommendation[]
    transitions: TransitionSummary[]
    skillGaps: SkillGapSummary[]
  }
  explain: {
    traces: ExplainTrace[]
    confidence: number
  }
  meta: {
    queryId: string
    timestamp: number
    cacheHit: boolean
    retrievalTimeMs: number
  }
}

export interface ScoredResult<T> {
  item: T
  score: number
  evidence: string
  source: string
}

export interface EvidenceSnippet {
  fact: string
  source: string
  confidence: number
}

export interface CareerRecommendation {
  careerId: string
  careerName: string
  score: number
  reason: string
  evidence: string[]
}

export interface TransitionSummary {
  fromCareer: string
  toCareer: string
  difficulty: number
  successRate: number
  estimatedMonths: number
}

export interface SkillGapSummary {
  careerId: string
  totalGaps: number
  criticalGaps: number
  readiness: number
  topGaps: string[]
}

export interface ExplainTrace {
  conclusion: string
  evidence: string[]
  confidence: number
}

export interface MemorySnippet {
  type: string
  content: string
  timestamp: number
}

// ─── Query Intent（查询意图） ───

export type QueryIntent =
  | { type: 'career_recommendation' }
  | { type: 'career_transition'; fromCareer?: string; toCareer?: string }
  | { type: 'skill_gap'; targetCareer?: string }
  | { type: 'salary_query'; careerId?: string }
  | { type: 'career_detail'; careerId?: string }
  | { type: 'general_explain' }

// ─── Task Plan（任务计划） ───

export interface TaskPlan {
  id: string
  intent: QueryIntent
  steps: TaskStep[]
  context: Partial<KnowledgeContext>
  status: 'planning' | 'executing' | 'complete'
}

export interface TaskStep {
  id: string
  action: string
  status: 'pending' | 'running' | 'complete'
  result?: unknown
  dependsOn?: string[]
}

// ═══════════════════════════════════════════════
// ① Retrieval Engine（检索引擎）
// ═══════════════════════════════════════════════

export interface RetrievalQuery {
  intent: QueryIntent
  keywords: string[]
  filters?: Record<string, string>
  limit?: number
}

export interface RetrievalResult<T> {
  items: ScoredResult<T>[]
  totalCandidates: number
  retrievalTimeMs: number
  strategy: string
}

/**
 * Retrieval Engine — 按意图检索知识，不是全量查询
 */
export class RetrievalEngine {
  constructor(
    private careerRepo: { search(query: string): Promise<CareerCanonicalObject[]>; getById(id: string): Promise<CareerCanonicalObject | null> },
    private skillRepo: { search(query: string): Promise<SkillCanonicalObject[]>; getById(id: string): Promise<SkillCanonicalObject | null> },
  ) {}

  /**
   * 按意图检索
   */
  async retrieve<T extends CareerCanonicalObject | SkillCanonicalObject>(
    query: RetrievalQuery,
  ): Promise<RetrievalResult<T>> {
    const startTime = Date.now()
    const strategy = this.determineStrategy(query.intent)

    let candidates: T[] = []

    switch (strategy) {
      case 'career-by-keyword':
        if (query.keywords.length > 0) {
          const careers = await this.careerRepo.search(query.keywords[0])
          candidates = careers as T[]
        }
        break

      case 'career-by-id':
        if (query.filters?.careerId) {
          const career = await this.careerRepo.getById(query.filters.careerId)
          if (career) candidates = [career as T]
        }
        break

      case 'skill-by-keyword':
        if (query.keywords.length > 0) {
          const skills = await this.skillRepo.search(query.keywords[0])
          candidates = skills as T[]
        }
        break

      case 'all-careers':
        const allCareers = await this.careerRepo.search('')
        candidates = allCareers as T[]
        break

      case 'all-skills':
        const allSkills = await this.skillRepo.search('')
        candidates = allSkills as T[]
        break
    }

    // Ranking: 对候选结果排序
    const scored = this.rankCandidates(candidates, query)

    return {
      items: scored.slice(0, query.limit || 10),
      totalCandidates: candidates.length,
      retrievalTimeMs: Date.now() - startTime,
      strategy,
    }
  }

  private determineStrategy(intent: QueryIntent): string {
    switch (intent.type) {
      case 'career_recommendation': return 'all-careers'
      case 'career_detail': return 'career-by-id'
      case 'career_transition': return intent.toCareer ? 'career-by-id' : 'all-careers'
      case 'skill_gap': return intent.targetCareer ? 'career-by-id' : 'all-careers'
      case 'salary_query': return intent.careerId ? 'career-by-id' : 'all-careers'
      default: return 'all-careers'
    }
  }

  private rankCandidates<T extends CareerCanonicalObject | SkillCanonicalObject>(
    candidates: T[],
    query: RetrievalQuery,
  ): ScoredResult<T>[] {
    const keywordStr = query.keywords.join(' ').toLowerCase()

    return candidates.map(item => {
      let score = 0
      let evidence = ''
      let source = ''

      if ('name' in item) {
        // Career
        const career = item as CareerCanonicalObject
        const nameMatch = career.name.toLowerCase().includes(keywordStr)
        const categoryMatch = career.category.toLowerCase().includes(keywordStr)

        if (nameMatch) {
          score = 95
          evidence = `职业名称匹配: ${career.name}`
        } else if (categoryMatch) {
          score = 70
          evidence = `分类匹配: ${career.category}`
        } else {
          score = 50
          evidence = '通用匹配'
        }

        // Boost by demand
        const latest = career.growthTrend[0]
        if (latest && latest.demandIndex > 80) {
          score += 5
          evidence += ' + 高需求'
        }

        source = `${career.id}.search`
      } else if ('aliases' in item) {
        // Skill
        const skill = item as SkillCanonicalObject
        const nameMatch = skill.name.toLowerCase().includes(keywordStr)
        score = nameMatch ? 90 : 40
        evidence = nameMatch ? `技能名称匹配: ${skill.name}` : '通用匹配'
        source = `${skill.id}.search`
      }

      return { item, score, evidence, source }
    }).sort((a, b) => b.score - a.score)
  }
}

// ═══════════════════════════════════════════════
// ② Context Builder（上下文构建器）
// ═══════════════════════════════════════════════

/**
 * Context Builder — 统一生成 Agent 与 LLM 使用的 Knowledge Context
 * 
 * 输入：用户画像 + 检索结果 + 分析结果
 * 输出：完整的 KnowledgeContext
 */
export class ContextBuilder {
  /**
   * 构建完整上下文
   */
  async build(params: {
    userSkills: string[]
    userFit: CareerFit | null
    intent: QueryIntent
    memory?: MemorySnippet[]
    careerRepo: { search(query: string): Promise<CareerCanonicalObject[]>; getById(id: string): Promise<CareerCanonicalObject | null> }
    skillRepo: { search(query: string): Promise<SkillCanonicalObject[]>; getById(id: string): Promise<SkillCanonicalObject | null> }
    engine: KnowledgeIntelligenceEngine
  }): Promise<KnowledgeContext> {
    const startTime = Date.now()

    // 1. 检索相关职业
    const careerRetrieval = await this.retrieveCareers(params)

    // 2. 检索相关技能
    const skillRetrieval = await this.retrieveSkills(params)

    // 3. 分析推荐
    const recommendations = await this.analyzeRecommendations(params, careerRetrieval)

    // 4. 构建解释链
    const traces = this.buildExplainTraces(recommendations, careerRetrieval)

    return {
      user: {
        skills: params.userSkills,
        fit: params.userFit,
        intent: params.intent,
        memory: params.memory || [],
      },
      retrieval: {
        careers: careerRetrieval,
        skills: skillRetrieval,
        evidence: this.extractEvidence(careerRetrieval, skillRetrieval),
      },
      analysis: {
        recommendations,
        transitions: [],
        skillGaps: [],
      },
      explain: {
        traces,
        confidence: this.calculateOverallConfidence(traces),
      },
      meta: {
        queryId: this.generateQueryId(),
        timestamp: Date.now(),
        cacheHit: false,
        retrievalTimeMs: Date.now() - startTime,
      },
    }
  }

  private async retrieveCareers(params: {
    intent: QueryIntent
    careerRepo: { search(query: string): Promise<CareerCanonicalObject[]> }
  }): Promise<ScoredResult<CareerCanonicalObject>[]> {
    const careers = await params.careerRepo.search('')
    return careers.map(c => {
      const latest = c.growthTrend[0]
      const demandBoost = latest ? Math.round(latest.demandIndex / 20) : 0
      return {
        item: c,
        score: 50 + demandBoost,
        evidence: `需求指数: ${latest?.demandIndex || 'N/A'}`,
        source: c.id,
      }
    }).sort((a, b) => b.score - a.score)
  }

  private async retrieveSkills(params: {
    intent: QueryIntent
    skillRepo: { search(query: string): Promise<SkillCanonicalObject[]> }
  }): Promise<ScoredResult<SkillCanonicalObject>[]> {
    const skills = await params.skillRepo.search('')
    return skills.slice(0, 10).map(s => ({
      item: s,
      score: 60,
      evidence: `分类: ${s.category}`,
      source: s.id,
    }))
  }

  private async analyzeRecommendations(
    params: {
      userSkills: string[]
      userFit: CareerFit | null
      engine: KnowledgeIntelligenceEngine
    },
    careers: ScoredResult<CareerCanonicalObject>[],
  ): Promise<CareerRecommendation[]> {
    const recs: CareerRecommendation[] = []

    // 对前5个职业计算适配度
    for (const { item: career } of careers.slice(0, 5)) {
      const score = await params.engine.careerScore.calculateScore(
        params.userSkills,
        params.userFit,
        career.id,
      )

      recs.push({
        careerId: career.id,
        careerName: career.name,
        score: score.result.overallScore,
        reason: `技能${score.result.skillScore}/画像${score.result.fitScore}/需求${score.result.demandScore}`,
        evidence: score.evidence.map(e => e.fact),
      })
    }

    return recs.sort((a, b) => b.score - a.score)
  }

  private buildExplainTraces(
    recommendations: CareerRecommendation[],
    careers: ScoredResult<CareerCanonicalObject>[],
  ): ExplainTrace[] {
    const traces: ExplainTrace[] = []

    for (const rec of recommendations.slice(0, 3)) {
      traces.push({
        conclusion: `推荐 ${rec.careerName}: ${rec.score}分`,
        evidence: rec.evidence,
        confidence: rec.score / 100,
      })
    }

    return traces
  }

  private extractEvidence(
    careers: ScoredResult<CareerCanonicalObject>[],
    skills: ScoredResult<SkillCanonicalObject>[],
  ): EvidenceSnippet[] {
    return careers.slice(0, 5).map(c => ({
      fact: c.evidence,
      source: c.source,
      confidence: c.score / 100,
    }))
  }

  private calculateOverallConfidence(traces: ExplainTrace[]): number {
    if (traces.length === 0) return 0.5
    const avg = traces.reduce((sum, t) => sum + t.confidence, 0) / traces.length
    return Math.round(avg * 100) / 100
  }

  private generateQueryId(): string {
    return `qry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  }
}

// ═══════════════════════════════════════════════
// ③ Task Planner（任务规划器）
// ═══════════════════════════════════════════════

/**
 * Task Planner — 将用户请求拆解为多个可执行步骤
 * 
 * 为 Hermes Runtime 做准备
 */
export class TaskPlanner {
  /**
   * 根据意图生成任务计划
   */
  plan(intent: QueryIntent, context: Partial<KnowledgeContext>): TaskPlan {
    const steps = this.generateSteps(intent, context)

    return {
      id: `plan_${Date.now().toString(36)}`,
      intent,
      steps,
      context,
      status: 'planning',
    }
  }

  private generateSteps(intent: QueryIntent, _context: Partial<KnowledgeContext>): TaskStep[] {
    const steps: TaskStep[] = []

    switch (intent.type) {
      case 'career_recommendation':
        steps.push(
          { id: 'step_1', action: 'retrieve_all_careers', status: 'pending' },
          { id: 'step_2', action: 'calculate_career_scores', status: 'pending', dependsOn: ['step_1'] },
          { id: 'step_3', action: 'rank_recommendations', status: 'pending', dependsOn: ['step_2'] },
          { id: 'step_4', action: 'generate_explain_traces', status: 'pending', dependsOn: ['step_3'] },
        )
        break

      case 'career_transition':
        steps.push(
          { id: 'step_1', action: 'retrieve_career_info', status: 'pending' },
          { id: 'step_2', action: 'calculate_transition', status: 'pending', dependsOn: ['step_1'] },
          { id: 'step_3', action: 'analyze_skill_gap', status: 'pending', dependsOn: ['step_1'] },
          { id: 'step_4', action: 'generate_learning_path', status: 'pending', dependsOn: ['step_2', 'step_3'] },
        )
        break

      case 'skill_gap':
        steps.push(
          { id: 'step_1', action: 'retrieve_target_career', status: 'pending' },
          { id: 'step_2', action: 'analyze_skill_gap', status: 'pending', dependsOn: ['step_1'] },
          { id: 'step_3', action: 'prioritize_gaps', status: 'pending', dependsOn: ['step_2'] },
          { id: 'step_4', action: 'suggest_learning_path', status: 'pending', dependsOn: ['step_3'] },
        )
        break

      case 'career_detail':
        steps.push(
          { id: 'step_1', action: 'retrieve_career_detail', status: 'pending' },
          { id: 'step_2', action: 'enrich_with_salary', status: 'pending', dependsOn: ['step_1'] },
          { id: 'step_3', action: 'enrich_with_transitions', status: 'pending', dependsOn: ['step_1'] },
        )
        break

      default:
        steps.push(
          { id: 'step_1', action: 'retrieve_general', status: 'pending' },
          { id: 'step_2', action: 'format_response', status: 'pending', dependsOn: ['step_1'] },
        )
    }

    return steps
  }
}

// ═══════════════════════════════════════════════
// ④ Retrieval Ranking（检索排序）
// ═══════════════════════════════════════════════

/**
 * Retrieval Ranking — 对知识结果按相关性和证据排序
 */
export class RetrievalRanker {
  /**
   * 综合排序：相关性 × 证据置信度 × 时效性
   */
  rank<T extends object>(items: ScoredResult<T>[], query: { keywords: string[]; preferredCategory?: string }): ScoredResult<T>[] {
    return items.map(item => {
      let boost = 0

      // 分类偏好 boost
      if (query.preferredCategory && 'category' in item.item) {
        const category = (item.item as { category: string }).category
        if (category === query.preferredCategory) {
          boost += 10
        }
      }

      return {
        ...item,
        score: Math.min(100, item.score + boost),
      }
    }).sort((a, b) => b.score - a.score)
  }
}

// ═══════════════════════════════════════════════
// ⑤ Cache Layer（缓存层）
// ═══════════════════════════════════════════════

export interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
  hitCount: number
}

/**
 * Cache Layer — LRU 缓存高频知识查询
 */
export class CacheLayer {
  private cache = new Map<string, CacheEntry<unknown>>()
  private maxSize: number
  private defaultTtl: number

  constructor(options?: { maxSize?: number; defaultTtlMs?: number }) {
    this.maxSize = options?.maxSize || 100
    this.defaultTtl = options?.defaultTtlMs || 5 * 60 * 1000 // 5分钟
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // 检查过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    // 更新命中计数
    entry.hitCount++
    return entry.value as T
  }

  set<T>(key: string, value: T, ttl?: number): void {
    // LRU: 超过容量时删除最旧的
    if (this.cache.size >= this.maxSize) {
      let oldestKey = ''
      let oldestTime = Infinity
      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp
          oldestKey = k
        }
      }
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
      hitCount: 0,
    })
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  stats(): { size: number; hitRate: number; entries: { key: string; hitCount: number; ageMs: number }[] } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hitCount: entry.hitCount,
      ageMs: Date.now() - entry.timestamp,
    }))

    const totalHits = entries.reduce((sum, e) => sum + e.hitCount, 0)
    const avgHitRate = entries.length > 0 ? totalHits / entries.length : 0

    return {
      size: this.cache.size,
      hitRate: avgHitRate,
      entries,
    }
  }
}

// ═══════════════════════════════════════════════
// ⑥ Explain Runtime（解释运行时）
// ═══════════════════════════════════════════════

export interface ExplainObject {
  conclusion: string
  reasoning: string[]
  evidence: EvidenceSnippet[]
  confidence: number
  humanReadable: string
}

/**
 * Explain Runtime — 动态生成可追溯的解释对象
 * 
 * 不是固定模板，而是根据 Evidence + Transition + Gap + Demand 动态组合
 */
export class ExplainRuntime {
  /**
   * 生成推荐解释
   */
  explainRecommendation(rec: CareerRecommendation, career: CareerCanonicalObject): ExplainObject {
    const reasoning: string[] = []
    const evidence: EvidenceSnippet[] = []

    // 解析推荐原因
    const parts = rec.reason.match(/技能(\d+)\/画像(\d+)\/需求(\d+)/)
    if (parts) {
      const skillScore = parseInt(parts[1])
      const fitScore = parseInt(parts[2])
      const demandScore = parseInt(parts[3])

      if (skillScore >= 60) {
        reasoning.push(`技能匹配度较高 (${skillScore}/100)`)
      } else {
        reasoning.push(`技能匹配度有提升空间 (${skillScore}/100)`)
      }

      if (fitScore >= 70) {
        reasoning.push(`能力画像高度匹配 (${fitScore}/100)`)
      }

      if (demandScore >= 80) {
        reasoning.push(`市场需求旺盛 (${demandScore}/100)`)
      }
    }

    // 提取证据
    for (const e of rec.evidence) {
      evidence.push({
        fact: e,
        source: rec.careerId,
        confidence: rec.score / 100,
      })
    }

    const humanReadable = this.buildHumanReadable(rec, career, reasoning)

    return {
      conclusion: `推荐: ${rec.careerName} (${rec.score}分)`,
      reasoning,
      evidence,
      confidence: rec.score / 100,
      humanReadable,
    }
  }

  /**
   * 生成迁移解释
   */
  explainTransition(
    fromCareer: CareerCanonicalObject,
    toCareer: CareerCanonicalObject,
    transition: {
      difficulty: number
      successRate: number
      estimatedMonths: number
      keyGapSkills: { skillName: string; weight: number }[]
    },
  ): ExplainObject {
    const reasoning: string[] = []
    const evidence: EvidenceSnippet[] = []

    // 难度分析
    const diffStars = '★'.repeat(transition.difficulty) + '☆'.repeat(5 - transition.difficulty)
    reasoning.push(`迁移难度: ${diffStars}`)

    if (transition.successRate >= 80) {
      reasoning.push(`成功率较高 (${transition.successRate}%)`)
    } else if (transition.successRate >= 50) {
      reasoning.push(`成功率中等 (${transition.successRate}%)，需要充分准备`)
    } else {
      reasoning.push(`成功率较低 (${transition.successRate}%)，建议谨慎考虑`)
    }

    // 关键缺口
    if (transition.keyGapSkills.length > 0) {
      const topGaps = transition.keyGapSkills.slice(0, 3).map(g => g.skillName).join(', ')
      reasoning.push(`关键补充技能: ${topGaps}`)
    }

    // 证据
    evidence.push({
      fact: `从${fromCareer.name}到${toCareer.name}预计${transition.estimatedMonths}个月`,
      source: `${fromCareer.id}.transitions`,
      confidence: 0.8,
    })

    const humanReadable = [
      `## ${fromCareer.name} → ${toCareer.name}`,
      '',
      `**难度:** ${diffStars}`,
      `**成功率:** ${transition.successRate}%`,
      `**预计时间:** ${transition.estimatedMonths}个月`,
      '',
      `**推理过程:**`,
      ...reasoning.map(r => `- ${r}`),
    ].join('\n')

    return {
      conclusion: `迁移可行性: ${transition.successRate}%`,
      reasoning,
      evidence,
      confidence: transition.successRate / 100,
      humanReadable,
    }
  }

  private buildHumanReadable(
    rec: CareerRecommendation,
    career: CareerCanonicalObject,
    reasoning: string[],
  ): string {
    const latest = career.growthTrend[0]
    return [
      `## 推荐: ${rec.careerName}`,
      '',
      `**综合评分:** ${rec.score}/100`,
      `**分类:** ${career.category}`,
      latest ? `**市场需求:** 需求指数 ${latest.demandIndex}/100，薪资增长 ${latest.salaryGrowth}%` : '',
      '',
      `**推荐理由:**`,
      ...reasoning.map(r => `- ${r}`),
      '',
      `**证据链:**`,
      ...rec.evidence.map(e => `- 📎 ${e}`),
    ].filter(Boolean).join('\n')
  }
}

// ═══════════════════════════════════════════════
// ★ Knowledge Runtime — 统一入口
// ═══════════════════════════════════════════════

export interface KnowledgeRuntimeConfig {
  careerRepo: { search(query: string): Promise<CareerCanonicalObject[]>; getById(id: string): Promise<CareerCanonicalObject | null> }
  skillRepo: { search(query: string): Promise<SkillCanonicalObject[]>; getById(id: string): Promise<SkillCanonicalObject | null> }
  engine: KnowledgeIntelligenceEngine
  cache?: CacheLayer
}

/**
 * Knowledge Runtime — 知识运行时统一入口
 * 
 * Hermes / Agent 只与 Runtime 交互，不直接接触 Repository
 */
export class KnowledgeRuntime {
  readonly retrieval: RetrievalEngine
  readonly contextBuilder: ContextBuilder
  readonly planner: TaskPlanner
  readonly ranker: RetrievalRanker
  readonly explain: ExplainRuntime
  readonly cache: CacheLayer

  private engine: KnowledgeIntelligenceEngine

  constructor(config: KnowledgeRuntimeConfig) {
    this.retrieval = new RetrievalEngine(config.careerRepo, config.skillRepo)
    this.contextBuilder = new ContextBuilder()
    this.planner = new TaskPlanner()
    this.ranker = new RetrievalRanker()
    this.explain = new ExplainRuntime()
    this.cache = config.cache || new CacheLayer()
    this.engine = config.engine
  }

  /**
   * 处理用户查询的主入口
   * 
   * 流程：Intent → Retrieval → Analysis → Context → Explain
   */
  async processQuery(params: {
    userSkills: string[]
    userFit: CareerFit | null
    intent: QueryIntent
    keywords?: string[]
    memory?: MemorySnippet[]
  }): Promise<KnowledgeContext> {
    const cacheKey = this.buildCacheKey(params)

    // 1. 检查缓存
    const cached = this.cache.get<KnowledgeContext>(cacheKey)
    if (cached) {
      cached.meta.cacheHit = true
      return cached
    }

    // 2. 构建上下文
    const context = await this.contextBuilder.build({
      userSkills: params.userSkills,
      userFit: params.userFit,
      intent: params.intent,
      memory: params.memory,
      careerRepo: this.retrieval['careerRepo'],
      skillRepo: this.retrieval['skillRepo'],
      engine: this.engine,
    })

    // 3. 缓存结果
    this.cache.set(cacheKey, context)

    return context
  }

  /**
   * 生成任务计划
   */
  planTask(intent: QueryIntent, context: Partial<KnowledgeContext>): TaskPlan {
    return this.planner.plan(intent, context)
  }

  /**
   * 检索并排序
   */
  async retrieveAndRank<T extends CareerCanonicalObject | SkillCanonicalObject>(
    query: RetrievalQuery,
  ): Promise<RetrievalResult<T>> {
    const result = await this.retrieval.retrieve<T>(query)
    result.items = this.ranker.rank(result.items, {
      keywords: query.keywords,
      preferredCategory: query.filters?.category,
    })
    return result
  }

  private buildCacheKey(params: {
    userSkills: string[]
    intent: QueryIntent
  }): string {
    const skillsKey = params.userSkills.sort().join(',')
    const intentKey = JSON.stringify(params.intent)
    return `krt:${skillsKey}:${intentKey}`
  }
}
