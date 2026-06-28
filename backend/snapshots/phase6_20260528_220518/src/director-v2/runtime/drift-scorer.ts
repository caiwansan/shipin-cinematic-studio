/**
 * drift-scorer.ts — Drift Reclassification System
 *
 * Phase 2A 升级：从"drift = 错误"到"drift = 分类信号"
 *
 * 不是所有 drift 都是错误。三种分类：
 *
 * 1. creative_variation（创造性变异）
 *    enrichment 在保持结构不变的前提下做了美学调整
 *    → 可接受，甚至值得奖励
 *    例：tone.min 从 0→2，但 dim 不变；visual palette 丰富化
 *
 * 2. structural_break（结构性断裂）
 *    enrichment 改变了骨架定义的核心结构
 *    → 必须拒绝
 *    例：theme 换主题、genre 换类型、protagonist 换角色
 *
 * 3. semantic_corruption（语义腐败）
 *    enrichment 输出有逻辑冲突或自我矛盾
 *    → 必须降级
 *    例：humor.min=8 但 coreTheme="沉重悲剧"
 */

import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Types
// ============================================================

export type DriftClassification = 'creative_variation' | 'structural_break' | 'semantic_corruption'

export interface DriftScore {
  overall: number              // 0-1
  dimensions: DriftDimension[]
  verdict: 'STABLE' | 'MODERATE' | 'UNSTABLE'
  classification: DriftClassification
  summary: string
}

export interface DriftDimension {
  name: string
  score: number                // 0 (相同) ~ 1 (完全不同)
  classification: DriftClassification
  detail: string
  confidence: number           // 此维度的分类置信度
}

// ============================================================
// Classification Metadata
// ============================================================

interface ClassificationRule {
  type: DriftClassification
  weight: number
  threshold: number
}

const DIMENSION_CLASSIFICATIONS: Record<string, ClassificationRule[]> = {
  theme: [
    { type: 'structural_break', weight: 5, threshold: 0.4 },
    { type: 'creative_variation', weight: 1, threshold: 0.1 },
  ],
  tone: [
    { type: 'creative_variation', weight: 3, threshold: 0.3 },
    { type: 'structural_break', weight: 2, threshold: 0.7 },
  ],
  character: [
    { type: 'structural_break', weight: 5, threshold: 0.3 },
    { type: 'semantic_corruption', weight: 3, threshold: 0.6 },
  ],
  emotion: [
    { type: 'creative_variation', weight: 4, threshold: 0.5 },
    { type: 'structural_break', weight: 3, threshold: 0.8 },
  ],
  genre: [
    { type: 'structural_break', weight: 5, threshold: 0.3 },
    { type: 'semantic_corruption', weight: 2, threshold: 0.7 },
  ],
  pacing: [
    { type: 'creative_variation', weight: 4, threshold: 0.4 },
    { type: 'structural_break', weight: 2, threshold: 0.8 },
  ],
}

// ============================================================
// Drift Reclassifier
// ============================================================

export class DriftReclassifier {
  score(
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
  ): DriftScore {
    const rawDimensions = this.computeAllDimensions(skeleton, enriched)
    const dimensions: DriftDimension[] = rawDimensions.map(d => {
      const classification = this.classifyDimension(d.name, d.score)
      return { ...d, classification: classification.type, confidence: classification.confidence }
    })

    const overall = this.computeWeightedOverall(dimensions)
    const classification = this.classifyOverall(dimensions, overall)

    const verdict: DriftScore['verdict'] =
      overall < 0.3 ? 'STABLE' :
      overall < 0.5 ? 'MODERATE' : 'UNSTABLE'

    const summary = this.buildSummary(overall, classification, verdict, dimensions)
    return { overall, dimensions, verdict, classification, summary }
  }

  // ===== Classification Resolver =====

  private classifyDimension(
    name: string,
    score: number,
  ): { type: DriftClassification; confidence: number } {
    const rules = DIMENSION_CLASSIFICATIONS[name]
    if (!rules) return { type: 'creative_variation', confidence: 0.5 }

    const matched = rules
      .filter(r => score >= r.threshold)
      .sort((a, b) => b.weight - a.weight)

    if (matched.length === 0) {
      return { type: 'creative_variation', confidence: 1 - score }
    }

    const best = matched[0]
    const margin = score - best.threshold
    const confidence = Math.min(1, margin + 0.5)
    return { type: best.type, confidence: Math.round(confidence * 100) / 100 }
  }

  private classifyOverall(
    dimensions: DriftDimension[],
    _overall: number,
  ): DriftClassification {
    if (dimensions.length === 0) return 'creative_variation'

    const structural = dimensions.filter(d => d.classification === 'structural_break')
    if (structural.length >= 2) return 'structural_break'
    if (structural.length === 1 && structural[0].confidence > 0.7) return 'structural_break'

    const corruptions = dimensions.filter(d => d.classification === 'semantic_corruption')
    if (corruptions.length > 0) return 'semantic_corruption'

    return 'creative_variation'
  }

  // ===== Scoring =====

  private computeWeightedOverall(dimensions: DriftDimension[]): number {
    if (dimensions.length === 0) return 0

    const weights: Record<DriftClassification, number> = {
      'structural_break': 3.0,
      'semantic_corruption': 2.0,
      'creative_variation': 0.5,
    }

    let weightedSum = 0
    let totalWeight = 0

    for (const dim of dimensions) {
      const w = weights[dim.classification] || 1.0
      weightedSum += dim.score * w
      totalWeight += w
    }

    return totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 100) / 100
      : 0
  }

  private buildSummary(
    overall: number,
    classification: DriftClassification,
    verdict: DriftScore['verdict'],
    dimensions: DriftDimension[],
  ): string {
    const parts = dimensions.map(d => `${d.name}=${d.score}(${this.abbrev(d.classification)})`)
    const label = classification === 'creative_variation' ? '🧠 CREATIVE' :
      classification === 'structural_break' ? '🔴 STRUCTURAL' : '🟡 CORRUPTION'

    const highestDim = dimensions.reduce((a, b) => a.score > b.score ? a : b, dimensions[0])
    const highDetail = highestDim ? `peak=${highestDim.name}:${highestDim.detail}` : ''
    return `${label} ${verdict} overall=${overall} [${parts.join(', ')}] ${highDetail}`
  }

  private abbrev(type: DriftClassification): string {
    return type === 'creative_variation' ? 'CV' :
      type === 'structural_break' ? 'SB' : 'SC'
  }

  // ===== Dimension Scorers =====

  private computeAllDimensions(
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
  ): Array<{ name: string; score: number; detail: string }> {
    return [
      this.scoreThemeDrift(skeleton, enriched),
      this.scoreToneDrift(skeleton, enriched),
      this.scoreCharacterDrift(skeleton, enriched),
      this.scoreEmotionDrift(skeleton, enriched),
      this.scoreGenreDrift(skeleton, enriched),
      this.scorePacingDrift(skeleton, enriched),
    ]
  }

  private scoreThemeDrift(skeleton: Record<string, unknown>, enriched: StoryConstitution) {
    const skelTheme = String(skeleton.coreTheme || '').trim().toLowerCase()
    const enrichTheme = String(enriched.coreTheme || '').trim().toLowerCase()

    if (!skelTheme || !enrichTheme) {
      return { name: 'theme', score: 0.5, detail: '缺少主题' }
    }

    // Strategy A: sliding-window containment check
    // 把骨架主题切分成 2-6 字符的 n-gram，检查是否都在 enrichment 中
    const minWindow = 4
    const maxWindow = Math.min(skelTheme.length, 10)
    let bestWindowMatch = false
    for (let len = maxWindow; len >= minWindow; len--) {
      for (let i = 0; i <= skelTheme.length - len; i++) {
        const window = skelTheme.slice(i, i + len)
        if (window.length >= minWindow && enrichTheme.includes(window)) {
          bestWindowMatch = true
          break
        }
      }
      if (bestWindowMatch) break
    }
    if (bestWindowMatch) {
      return { name: 'theme', score: 0, detail: `window match: OK` }
    }

    // Strategy B: containment ratio for keywords
    const stopWords = new Set(['的', '了', '在', '是', '一个', '这个', '那个', '我', '你', '他', '她', '它', '们'])
    const skelWords = skelTheme.split(/[\s,，。.、！!？?]+/).filter(w => w.length >= 2 && !stopWords.has(w))
    const uniqueSkel = new Set(skelWords)

    if (uniqueSkel.size === 0) return { name: 'theme', score: 0.5, detail: '主题无有效关键词' }

    let containmentHits = 0
    for (const word of uniqueSkel) {
      if (enrichTheme.includes(word)) containmentHits++
    }
    const containmentRatio = containmentHits / uniqueSkel.size

    const score = containmentRatio >= 0.7 ? 1 - containmentRatio * 1.1 :
      containmentRatio >= 0.4 ? 1 - containmentRatio * 1.0 :
      1 - containmentRatio * 0.6

    const clampedScore = Math.round(Math.max(0, Math.min(score, 1)) * 100) / 100

    return {
      name: 'theme',
      score: clampedScore,
      detail: `contain=${containmentRatio.toFixed(2)}`,
    }
  }

  private scoreToneDrift(skeleton: Record<string, unknown>, enriched: StoryConstitution) {
    const skelTones = (skeleton.toneBoundaries as Array<Record<string, unknown>>) || []
    const enrichTones = enriched.toneBoundaries || []

    if (!skelTones.length || !enrichTones.length) {
      return { name: 'tone', score: 0.5, detail: '缺少基调数据' }
    }

    let totalDrift = 0; let comparisons = 0
    const enrichMap = new Map(enrichTones.map(t => [String(t.dimension), t]))

    for (const skel of skelTones) {
      const dim = String(skel.dimension)
      const enrich = enrichMap.get(dim)
      if (!enrich) { totalDrift += 1; comparisons++; continue }

      const minDrift = Math.abs(Number(skel.min || 0) - Number(enrich.min || 0)) / 10
      const maxDrift = Math.abs(Number(skel.max || 10) - Number(enrich.max || 10)) / 10
      totalDrift += (minDrift + maxDrift) / 2
      comparisons++
    }

    return {
      name: 'tone',
      score: comparisons > 0 ? Math.round((totalDrift / comparisons) * 100) / 100 : 0.5,
      detail: `${comparisons} 个维度`,
    }
  }

  private scoreCharacterDrift(skeleton: Record<string, unknown>, enriched: StoryConstitution) {
    const skelChars = (skeleton.characterLaws as Array<Record<string, unknown>>) || []
    const enrichChars = enriched.characterLaws || []

    if (!skelChars.length) return { name: 'character', score: 0.5, detail: '骨架无角色' }

    const skelIds = new Set(skelChars.map(c => String(c.characterId || c.name)))
    const enrichIds = new Set(enrichChars.map(c => String(c.characterId || c.name)))

    const missing = [...skelIds].filter(id => !enrichIds.has(id))
    const added = [...enrichIds].filter(id => !skelIds.has(id))

    const changes = missing.length + added.length
    const total = Math.max(skelIds.size, enrichIds.size, 1)
    const score = Math.min(changes / total, 1)

    const detail = [
      missing.length ? `缺失 ${missing.length}` : '',
      added.length ? `新增 ${added.length}` : '',
    ].filter(Boolean).join(', ') || '一致'

    return { name: 'character', score: Math.round(score * 100) / 100, detail }
  }

  private scoreEmotionDrift(skeleton: Record<string, unknown>, enriched: StoryConstitution) {
    const skelE = (skeleton.emotionalTrajectory as Record<string, unknown>) || {}
    const enrichE = enriched.emotionalTrajectory || {}

    const skelDominant = String(skelE.dominantEmotion || '')
    const enrichDominant = String(enrichE.dominantEmotion || '')
    const skelArc = String(skelE.arcType || '')
    const enrichArc = String(enrichE.arcType || '')

    let score = 0; const changes: string[] = []

    if (skelDominant && enrichDominant && skelDominant !== enrichDominant) {
      if (!enrichDominant.includes(skelDominant) && !skelDominant.includes(enrichDominant)) {
        score = 0.6
        changes.push(`情绪 ${skelDominant}→${enrichDominant}`)
      }
    }
    if (skelArc && enrichArc && skelArc !== enrichArc) {
      score = Math.max(score, 0.4)
      changes.push(`弧线 ${skelArc}→${enrichArc}`)
    }

    return {
      name: 'emotion',
      score: Math.round(score * 100) / 100,
      detail: changes.length ? changes.join(', ') : '一致',
    }
  }

  private scoreGenreDrift(skeleton: Record<string, unknown>, enriched: StoryConstitution) {
    const skelW = (skeleton.worldPhysics as Record<string, unknown>) || {}
    const enrichW = enriched.worldPhysics || {}

    const skelEnv = String(skelW.environmentType || '')
    const enrichEnv = String(enrichW.environmentType || '')
    const skelPeriod = String(skelW.timePeriod || '')
    const enrichPeriod = String(enrichW.timePeriod || '')

    let score = 0; const changes: string[] = []

    if (skelEnv && enrichEnv && skelEnv !== enrichEnv) {
      score += 0.7; changes.push(`环境 ${skelEnv}→${enrichEnv}`)
    }
    if (skelPeriod && enrichPeriod && skelPeriod !== enrichPeriod) {
      score += 0.3; changes.push(`时期 ${skelPeriod}→${enrichPeriod}`)
    }

    return {
      name: 'genre',
      score: Math.round(score * 100) / 100,
      detail: changes.length ? changes.join(', ') : '一致',
    }
  }

  private scorePacingDrift(skeleton: Record<string, unknown>, enriched: StoryConstitution) {
    const skelP = (skeleton.pacingDoctrine as Record<string, unknown>) || {}
    const enrichP = enriched.pacingDoctrine || {}

    const skelStruct = String(skelP.structureType || '')
    const enrichStruct = String(enrichP.structureType || '')
    const skelCurve = String(skelP.pacingCurve || '')
    const enrichCurve = String(enrichP.pacingCurve || '')

    let score = 0; const changes: string[] = []

    if (skelStruct && enrichStruct && skelStruct !== enrichStruct) {
      score += 0.5; changes.push(`结构 ${skelStruct}→${enrichStruct}`)
    }
    if (skelCurve && enrichCurve && skelCurve !== enrichCurve) {
      score += 0.5; changes.push(`曲线 ${skelCurve}→${enrichCurve}`)
    }

    return {
      name: 'pacing',
      score: Math.round(score * 100) / 100,
      detail: changes.length ? changes.join(', ') : '一致',
    }
  }
}

/** 全局单例 (backward compat) */
export const driftScorer = new DriftReclassifier()
