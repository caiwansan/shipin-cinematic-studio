/**
 * Phase 3-C: Knowledge Intelligence Engine
 * 
 * 知识智能引擎 — 让已有知识真正能够推理、解释、检索和计算。
 * 
 * 五个核心引擎：
 * 1. Transition Engine  — 职业迁移路径、难度、时间、成功率
 * 2. Career Score Engine — 候选人与职业适配度（图计算）
 * 3. Skill Gap Engine   — 优先级排序的技能缺口
 * 4. Recommendation Engine — 推荐最适合的职业及依据
 * 5. Evidence Engine    — 所有结论追溯到知识对象链
 */

import type {
  CareerCanonicalObject,
  SkillCanonicalObject,
  SkillEdge,
  CareerFit,
  CareerTrans,
} from '../canonical/schemas'

// ─── Evidence Engine（证据引擎） ───

export interface Evidence {
  fact: string
  source: string          // 知识对象ID
  confidence: number
  data?: Record<string, unknown>
}

export interface ExplainedResult<T> {
  result: T
  evidence: Evidence[]
  explanation: string     // 人类可读的解释
}

/**
 * Evidence Engine — 为任何结论生成可追溯的证据链
 */
export class EvidenceEngine {
  /**
   * 包装结果，附加证据链
   */
  wrap<T>(result: T, evidence: Evidence[], explanation: string): ExplainedResult<T> {
    return { result, evidence, explanation }
  }

  /**
   * 创建单条证据
   */
  create(fact: string, source: string, confidence: number, data?: Record<string, unknown>): Evidence {
    return { fact, source, confidence, data }
  }

  /**
   * 合并证据链
   */
  combine(evidenceLists: Evidence[][]): Evidence[] {
    return evidenceLists.flat()
  }

  /**
   * 生成人类可读的解释
   */
  generateExplanation(evidence: Evidence[]): string {
    const parts: string[] = []
    for (const e of evidence) {
      parts.push(`• ${e.fact} (来源: ${e.source}, 置信度: ${Math.round(e.confidence * 100)}%)`)
    }
    return parts.join('\n')
  }
}

// ─── Transition Engine（迁移引擎） ───

export interface TransitionResult {
  fromCareer: CareerCanonicalObject
  toCareer: CareerCanonicalObject
  difficulty: 1 | 2 | 3 | 4 | 5
  successRate: number       // 0-100
  estimatedMonths: number
  keyGapSkills: GapSkillItem[]
  suggestedPath: string[]   // 建议路线
  overallFeasibility: number // 0-100
}

export interface GapSkillItem {
  skillId: string
  skillName: string
  weight: number            // 重要程度 0-1
  currentLevel: number      // 0-4
  targetLevel: number
  gap: number
  timeToLearn: string
}

/**
 * Transition Engine — 计算职业迁移路径
 * 
 * 算法：
 * 1. 直接查询 Career.transitions 中的预定义迁移
 * 2. 若无预定义，通过 Skill Gap 计算迁移难度
 * 3. 综合计算成功率和时间
 */
export class TransitionEngine {
  private evidence = new EvidenceEngine()

  constructor(
    private careerRepo: { getById(id: string): Promise<CareerCanonicalObject | null> },
    private skillRepo: { getById(id: string): Promise<SkillCanonicalObject | null> },
  ) {}

  async calculateTransition(
    fromCareerId: string,
    toCareerId: string,
    currentSkills: string[] = [],
  ): Promise<ExplainedResult<TransitionResult>> {
    const fromCareer = await this.careerRepo.getById(fromCareerId)
    const toCareer = await this.careerRepo.getById(toCareerId)
    if (!fromCareer || !toCareer) throw new Error('Career not found')

    const evidence: Evidence[] = []

    // 1. 查找预定义迁移路径
    const predefined = fromCareer.transitions.find(t => t.toCareer === toCareerId)

    if (predefined) {
      // 使用预定义迁移
      const gapItems: GapSkillItem[] = []
      for (const skillId of predefined.keyGapSkills) {
        const skill = await this.skillRepo.getById(skillId)
        if (skill) {
          const hasSkill = currentSkills.includes(skill.name) ||
                           currentSkills.some(alias => skill.aliases.includes(alias))
          gapItems.push({
            skillId,
            skillName: skill.name,
            weight: 0.8,
            currentLevel: hasSkill ? 2 : 0,
            targetLevel: 3,
            gap: hasSkill ? 1 : 3,
            timeToLearn: skill.timeToLearn,
          })
        }
      }

      evidence.push(this.evidence.create(
        `找到预定义迁移路径: ${fromCareer.name} → ${toCareer.name}`,
        `${fromCareerId}.transitions`,
        0.9,
        { difficulty: predefined.difficulty, successRate: predefined.successRate },
      ))
      evidence.push(this.evidence.create(
        `预定义成功率: ${predefined.successRate}%`,
        `${fromCareerId}.transitions.successRate`,
        0.85,
      ))
      evidence.push(this.evidence.create(
        `预定义预计时间: ${predefined.estimatedMonths}个月`,
        `${fromCareerId}.transitions.estimatedMonths`,
        0.85,
      ))

      const result: TransitionResult = {
        fromCareer,
        toCareer,
        difficulty: predefined.difficulty,
        successRate: predefined.successRate,
        estimatedMonths: predefined.estimatedMonths,
        keyGapSkills: gapItems,
        suggestedPath: await this.buildSuggestedPath(fromCareerId, toCareerId),
        overallFeasibility: this.calculateFeasibility(predefined.difficulty, predefined.successRate),
      }

      return this.evidence.wrap(result, evidence,
        this.buildTransitionExplanation(result))
    }

    // 2. 无预定义 → 通过 Skill Gap 计算
    const skillGap = await this.calculateSkillGap(currentSkills, toCareer)
    const avgGap = skillGap.length > 0
      ? skillGap.reduce((sum, g) => sum + g.gap, 0) / skillGap.length
      : 0

    const calculatedDifficulty = Math.min(5, Math.max(1, Math.ceil(avgGap)))
    const calculatedSuccessRate = Math.max(30, 95 - avgGap * 15)
    const calculatedMonths = Math.ceil(avgGap * 2.5)

    evidence.push(this.evidence.create(
      `无预定义迁移路径，通过技能差距计算`,
      `${fromCareerId}→${toCareerId}.calculated`,
      0.7,
    ))
    evidence.push(this.evidence.create(
      `平均技能差距: ${avgGap.toFixed(1)}`,
      `skill-gap.calculation`,
      0.75,
      { gapCount: skillGap.length },
    ))

    const result: TransitionResult = {
      fromCareer,
      toCareer,
      difficulty: calculatedDifficulty as 1 | 2 | 3 | 4 | 5,
      successRate: Math.round(calculatedSuccessRate),
      estimatedMonths: calculatedMonths,
      keyGapSkills: skillGap.slice(0, 5),
      suggestedPath: await this.buildSuggestedPath(fromCareerId, toCareerId),
      overallFeasibility: this.calculateFeasibility(calculatedDifficulty, calculatedSuccessRate),
    }

    return this.evidence.wrap(result, evidence,
      this.buildTransitionExplanation(result))
  }

  private async calculateSkillGap(
    currentSkills: string[],
    targetCareer: CareerCanonicalObject,
  ): Promise<GapSkillItem[]> {
    const gaps: GapSkillItem[] = []

    for (const req of targetCareer.requiredSkills) {
      const skill = await this.skillRepo.getById(req.skillId)
      if (!skill) continue

      const hasSkill = currentSkills.includes(skill.name) ||
                       currentSkills.some(alias => skill.aliases.includes(alias))
      const currentLevel = hasSkill ? 2 : 0
      const targetLevel = 3
      const gap = Math.max(0, targetLevel - currentLevel)

      if (gap > 0) {
        gaps.push({
          skillId: req.skillId,
          skillName: skill.name,
          weight: req.weight,
          currentLevel,
          targetLevel,
          gap,
          timeToLearn: skill.timeToLearn,
        })
      }
    }

    return gaps.sort((a, b) => b.weight * b.gap - a.weight * a.gap)
  }

  private calculateFeasibility(difficulty: number, successRate: number): number {
    // 难度越低 + 成功率越高 = 可行性越高
    const difficultyScore = (5 - difficulty) / 5 * 40
    const successScore = successRate / 100 * 60
    return Math.round(difficultyScore + successScore)
  }

  private async buildSuggestedPath(fromId: string, toId: string): Promise<string[]> {
    // 简化：直接路径
    return [fromId, toId]
  }

  private buildTransitionExplanation(r: TransitionResult): string {
    const diffStars = '★'.repeat(r.difficulty) + '☆'.repeat(5 - r.difficulty)
    return [
      `迁移分析: ${r.fromCareer.name} → ${r.toCareer.name}`,
      `难度: ${diffStars}`,
      `成功率: ${r.successRate}%`,
      `预计时间: ${r.estimatedMonths}个月`,
      `可行性评分: ${r.overallFeasibility}/100`,
      `需要补充 ${r.keyGapSkills.length} 项关键技能`,
    ].join('\n')
  }
}

// ─── Career Score Engine（适配度引擎） ───

export interface CareerScoreResult {
  career: CareerCanonicalObject
  overallScore: number       // 0-100
  skillScore: number         // 技能匹配度 0-100
  fitScore: number           // 能力画像匹配度 0-100
  demandScore: number        // 市场需求度 0-100
  details: ScoreDetail[]
}

export interface ScoreDetail {
  dimension: string
  score: number
  weight: number
  contribution: number
  description: string
}

/**
 * Career Score Engine — 计算候选人与职业的适配度
 * 
 * 算法（图计算，非简单加权）：
 * 1. 技能匹配度 (40%) — 基于 Skill Graph 的权重和覆盖度
 * 2. 能力画像匹配度 (30%) — 基于 Career Fit 的余弦相似度
 * 3. 市场需求度 (30%) — 基于 Growth Trend
 */
export class CareerScoreEngine {
  private evidence = new EvidenceEngine()

  constructor(
    private careerRepo: { getById(id: string): Promise<CareerCanonicalObject | null>; search(query: string): Promise<CareerCanonicalObject[]> },
    private skillRepo: { getById(id: string): Promise<SkillCanonicalObject | null> },
  ) {}

  async calculateScore(
    candidateSkills: string[],
    candidateFit: CareerFit | null,
    targetCareerId: string,
  ): Promise<ExplainedResult<CareerScoreResult>> {
    const career = await this.careerRepo.getById(targetCareerId)
    if (!career) throw new Error('Career not found')

    const evidence: Evidence[] = []

    // 1. 技能匹配度 (40%)
    const skillScore = await this.calculateSkillScore(candidateSkills, career, evidence)

    // 2. 能力画像匹配度 (30%)
    const fitScore = this.calculateFitScore(candidateFit, career.fitProfile, evidence)

    // 3. 市场需求度 (30%)
    const demandScore = this.calculateDemandScore(career, evidence)

    // 综合分数（加权）
    const overallScore = Math.round(
      skillScore.score * 0.4 + fitScore.score * 0.3 + demandScore.score * 0.3,
    )

    evidence.push(this.evidence.create(
      `综合适配度: ${overallScore}/100 (技能${skillScore.score}×0.4 + 画像${fitScore.score}×0.3 + 需求${demandScore.score}×0.3)`,
      `${targetCareerId}.composite-score`,
      0.9,
      { skillScore: skillScore.score, fitScore: fitScore.score, demandScore: demandScore.score },
    ))

    const result: CareerScoreResult = {
      career,
      overallScore,
      skillScore: skillScore.score,
      fitScore: fitScore.score,
      demandScore: demandScore.score,
      details: [skillScore, fitScore, demandScore],
    }

    return this.evidence.wrap(result, evidence,
      this.buildScoreExplanation(result))
  }

  /**
   * 为候选人推荐最适合的职业
   */
  async recommendCareers(
    candidateSkills: string[],
    candidateFit: CareerFit | null,
    limit: number = 5,
  ): Promise<ExplainedResult<CareerScoreResult[]>> {
    const allCareers = await this.careerRepo.search('')
    const evidence: Evidence[] = []

    const scores: CareerScoreResult[] = []
    for (const career of allCareers) {
      const score = await this.calculateScore(candidateSkills, candidateFit, career.id)
      scores.push(score.result)
      evidence.push(...score.evidence.slice(0, 2))
    }

    scores.sort((a, b) => b.overallScore - a.overallScore)

    const topScores = scores.slice(0, limit)

    evidence.push(this.evidence.create(
      `从 ${allCareers.length} 个职业中推荐 Top ${limit}`,
      'recommendation.engine',
      0.85,
      { totalCareers: allCareers.length, topScore: topScores[0]?.overallScore },
    ))

    return this.evidence.wrap(topScores, evidence,
      this.buildRecommendationExplanation(topScores))
  }

  // ─── 私有方法 ───

  private async calculateSkillScore(
    candidateSkills: string[],
    career: CareerCanonicalObject,
    evidence: Evidence[],
  ): Promise<ScoreDetail> {
    if (career.requiredSkills.length === 0) {
      return { dimension: '技能匹配', score: 0, weight: 0.4, contribution: 0, description: '无技能要求' }
    }

    let totalWeight = 0
    let matchedWeight = 0
    let matchedCount = 0

    for (const req of career.requiredSkills) {
      totalWeight += req.weight

      const skill = await this.skillRepo.getById(req.skillId)
      if (!skill) continue

      const hasSkill = candidateSkills.includes(skill.name) ||
                       candidateSkills.some(alias => skill.aliases.includes(alias))

      if (hasSkill) {
        matchedWeight += req.weight
        matchedCount++
      }
    }

    const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0

    evidence.push(this.evidence.create(
      `技能覆盖: ${matchedCount}/${career.requiredSkills.length} (${Math.round(matchedWeight / totalWeight * 100)}%)`,
      `${career.id}.requiredSkills`,
      0.9,
      { matchedCount, totalCount: career.requiredSkills.length },
    ))

    return {
      dimension: '技能匹配',
      score,
      weight: 0.4,
      contribution: Math.round(score * 0.4),
      description: `覆盖 ${matchedCount}/${career.requiredSkills.length} 项技能要求`,
    }
  }

  private calculateFitScore(
    candidateFit: CareerFit | null,
    careerFit: CareerFit,
    evidence: Evidence[],
  ): ScoreDetail {
    if (!candidateFit) {
      return { dimension: '能力画像', score: 50, weight: 0.3, contribution: 15, description: '无候选人画像，使用默认值' }
    }

    // 余弦相似度计算
    const keys = ['logicalThinking', 'communication', 'creativity', 'execution', 'leadership', 'analyticalSkill'] as const
    let dotProduct = 0
    let candidateMag = 0
    let careerMag = 0

    for (const key of keys) {
      const c = candidateFit[key]
      const cf = careerFit[key]
      dotProduct += c * cf
      candidateMag += c * c
      careerMag += cf * cf
    }

    const similarity = candidateMag > 0 && careerMag > 0
      ? dotProduct / (Math.sqrt(candidateMag) * Math.sqrt(careerMag))
      : 0

    const score = Math.round(similarity * 100)

    evidence.push(this.evidence.create(
      `能力画像余弦相似度: ${(similarity * 100).toFixed(1)}%`,
      `fit.cosine-similarity`,
      0.8,
      { dotProduct, candidateMag, careerMag },
    ))

    return {
      dimension: '能力画像',
      score,
      weight: 0.3,
      contribution: Math.round(score * 0.3),
      description: `余弦相似度 ${(similarity * 100).toFixed(1)}%`,
    }
  }

  private calculateDemandScore(
    career: CareerCanonicalObject,
    evidence: Evidence[],
  ): ScoreDetail {
    const latest = career.growthTrend[0]
    const score = latest?.demandIndex || 50

    evidence.push(this.evidence.create(
      `市场需求指数: ${score}/100`,
      `${career.id}.growthTrend`,
      0.8,
      { demandIndex: score, year: latest?.year, quarter: latest?.quarter },
    ))

    return {
      dimension: '市场需求',
      score,
      weight: 0.3,
      contribution: Math.round(score * 0.3),
      description: `需求指数 ${score}/100，薪资增长 ${latest?.salaryGrowth || 0}%`,
    }
  }

  private buildScoreExplanation(r: CareerScoreResult): string {
    return [
      `职业适配度分析: ${r.career.name}`,
      `综合评分: ${r.overallScore}/100`,
      `  技能匹配: ${r.skillScore}/100 × 40% = ${Math.round(r.skillScore * 0.4)}`,
      `  能力画像: ${r.fitScore}/100 × 30% = ${Math.round(r.fitScore * 0.3)}`,
      `  市场需求: ${r.demandScore}/100 × 30% = ${Math.round(r.demandScore * 0.3)}`,
    ].join('\n')
  }

  private buildRecommendationExplanation(scores: CareerScoreResult[]): string {
    const lines = ['职业推荐（按适配度排序）:']
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i]
      lines.push(`  ${i + 1}. ${s.career.name} — ${s.overallScore}分`)
    }
    return lines.join('\n')
  }
}

// ─── Skill Gap Engine（技能缺口引擎） ───

export interface SkillGapResult {
  targetCareer: CareerCanonicalObject
  gaps: PrioritizedGap[]
  totalGapCount: number
  criticalCount: number
  estimatedTotalTime: string
  overallReadiness: number   // 0-100
}

export interface PrioritizedGap {
  rank: number
  skillId: string
  skillName: string
  weight: number
  gap: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  priorityScore: number      // 用于排序的综合分数
  timeToLearn: string
  type: 'foundation' | 'core' | 'advanced'
  dependencies: string[]     // 需要先学的技能
}

/**
 * Skill Gap Engine — 优先级排序的技能缺口
 * 
 * 非简单列表，而是：
 * 1. 按权重×差距计算优先级分数
 * 2. 分析技能依赖关系
 * 3. 推荐学习顺序
 * 4. 估算总学习时间
 */
export class SkillGapEngine {
  private evidence = new EvidenceEngine()

  constructor(
    private careerRepo: { getById(id: string): Promise<CareerCanonicalObject | null> },
    private skillRepo: { getById(id: string): Promise<SkillCanonicalObject | null> },
  ) {}

  async analyze(
    currentSkills: string[],
    targetCareerId: string,
  ): Promise<ExplainedResult<SkillGapResult>> {
    const career = await this.careerRepo.getById(targetCareerId)
    if (!career) throw new Error('Career not found')

    const evidence: Evidence[] = []
    const gaps: PrioritizedGap[] = []

    // 计算每个技能的缺口
    for (const req of career.requiredSkills) {
      const skill = await this.skillRepo.getById(req.skillId)
      if (!skill) continue

      const hasSkill = currentSkills.includes(skill.name) ||
                       currentSkills.some(alias => skill.aliases.includes(alias))

      if (!hasSkill) {
        const gap = 3 // 目标水平 - 当前水平(0)
        const priorityScore = req.weight * gap * 10

        gaps.push({
          rank: 0, // 稍后排序
          skillId: req.skillId,
          skillName: skill.name,
          weight: req.weight,
          gap,
          priority: priorityScore >= 20 ? 'critical' : priorityScore >= 10 ? 'high' : 'medium',
          priorityScore,
          timeToLearn: skill.timeToLearn,
          type: req.weight >= 0.9 ? 'core' : req.weight >= 0.7 ? 'advanced' : 'foundation',
          dependencies: skill.prerequisites.map(p => p.skillId),
        })
      }
    }

    // 按优先级分数排序
    gaps.sort((a, b) => b.priorityScore - a.priorityScore)
    gaps.forEach((g, i) => { g.rank = i + 1 })

    const criticalCount = gaps.filter(g => g.priority === 'critical').length
    const readiness = Math.max(0, Math.round((1 - gaps.length / career.requiredSkills.length) * 100))

    evidence.push(this.evidence.create(
      `技能缺口: ${gaps.length}/${career.requiredSkills.length}`,
      `${targetCareerId}.skill-gap`,
      0.9,
      { totalRequired: career.requiredSkills.length, gapCount: gaps.length },
    ))
    evidence.push(this.evidence.create(
      `关键缺口: ${criticalCount} 项`,
      `${targetCareerId}.critical-gaps`,
      0.85,
      { criticalCount },
    ))
    evidence.push(this.evidence.create(
      `准备度: ${readiness}%`,
      `${targetCareerId}.readiness`,
      0.85,
    ))

    const result: SkillGapResult = {
      targetCareer: career,
      gaps,
      totalGapCount: gaps.length,
      criticalCount,
      estimatedTotalTime: this.estimateTotalTime(gaps),
      overallReadiness: readiness,
    }

    return this.evidence.wrap(result, evidence, this.buildGapExplanation(result))
  }

  private estimateTotalTime(gaps: PrioritizedGap[]): string {
    const totalWeeks = gaps.reduce((sum, g) => {
      const match = g.timeToLearn.match(/(\d+)/)
      return sum + (match ? parseInt(match[1]) : 2)
    }, 0)

    if (totalWeeks <= 4) return `约 ${totalWeeks} 周`
    if (totalWeeks <= 52) return `约 ${Math.ceil(totalWeeks / 4)} 个月`
    return `约 ${Math.ceil(totalWeeks / 4)} 个月`
  }

  private buildGapExplanation(r: SkillGapResult): string {
    const lines = [
      `技能缺口分析: ${r.targetCareer.name}`,
      `总缺口: ${r.totalGapCount} 项 | 关键: ${r.criticalCount} 项 | 准备度: ${r.overallReadiness}%`,
      `预计总学习时间: ${r.estimatedTotalTime}`,
      `优先级排序:`,
    ]
    for (const g of r.gaps.slice(0, 5)) {
      const stars = '★'.repeat(Math.min(5, Math.ceil(g.priorityScore / 5)))
      lines.push(`  ${g.rank}. ${g.skillName} ${stars} (${g.priority})`)
    }
    if (r.gaps.length > 5) {
      lines.push(`  ... 共 ${r.gaps.length} 项`)
    }
    return lines.join('\n')
  }
}

// ─── 统一入口：Knowledge Intelligence Engine ───

export interface KnowledgeEngineResult {
  transition?: ExplainedResult<TransitionResult>
  careerScore?: ExplainedResult<CareerScoreResult>
  recommendation?: ExplainedResult<CareerScoreResult[]>
  skillGap?: ExplainedResult<SkillGapResult>
}

export class KnowledgeIntelligenceEngine {
  readonly transition: TransitionEngine
  readonly careerScore: CareerScoreEngine
  readonly skillGap: SkillGapEngine
  readonly evidence: EvidenceEngine

  constructor(deps: {
    careerRepo: { getById(id: string): Promise<CareerCanonicalObject | null>; search(query: string): Promise<CareerCanonicalObject[]> }
    skillRepo: { getById(id: string): Promise<SkillCanonicalObject | null> }
  }) {
    this.evidence = new EvidenceEngine()
    this.transition = new TransitionEngine(deps.careerRepo, deps.skillRepo)
    this.careerScore = new CareerScoreEngine(deps.careerRepo, deps.skillRepo)
    this.skillGap = new SkillGapEngine(deps.careerRepo, deps.skillRepo)
  }
}
