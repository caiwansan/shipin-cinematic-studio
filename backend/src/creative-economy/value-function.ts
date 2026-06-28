/**
 * creative-economy/value-function.ts
 *
 * ⚔️ Phase 7 — Creative Value Function（创作价值函数）
 *
 * 定义什么是"好内容"。
 * 评分维度（禁止使用 engagement metrics）：
 *   - narrative coherence (40%) — 叙事连贯性
 *   - structural stability (30%) — 结构稳定性
 *   - execution fidelity (30%)  — 执行忠实度
 *
 * 禁止：
 *   - click optimization
 *   - engagement hacking
 *   - virality scoring
 */

import type { DirectorPlan } from '../director-runtime/types.js'
import type { VideoBlueprint } from '../types/video-blueprint.js'

// ── 评分结果 ──

export interface CreativeValueScore {
  /** 总分（0-100） */
  total: number
  /** 各维度明细 */
  dimensions: {
    narrativeCoherence: {
      score: number
      weight: number
      details: string[]
    }
    structuralStability: {
      score: number
      weight: number
      details: string[]
    }
    executionFidelity: {
      score: number
      weight: number
      details: string[]
    }
  }
  /** 评级 */
  grade: 'S' | 'A' | 'B' | 'C' | 'F'
}

// ── 1. Narrative Coherence（40%） ──

function scoreNarrativeCoherence(plan: DirectorPlan): { score: number; details: string[] } {
  const details: string[] = []

  // 1.1 情绪弧线变化幅度（相邻场景的情绪变化越小越连贯）
  let coherenceScore = 100
  for (let i = 1; i < plan.emotionalArc.length; i++) {
    const emotionIntensity = (e: string): number => {
      const map: Record<string, number> = {
        '绝望': 1, '悲伤': 2, '忧郁': 3, '平静': 4, '期待': 5,
        '希望': 6, '紧张': 6, '恐惧': 5, '愤怒': 5, '惊讶': 7,
        '喜悦': 8, '狂喜': 9, '震撼': 9, '感动': 7, '温馨': 6,
      }
      return map[e] ?? 4
    }
    const diff = Math.abs(emotionIntensity(plan.emotionalArc[i]) - emotionIntensity(plan.emotionalArc[i - 1]))
    if (diff > 4) {
      coherenceScore -= 10
      details.push(`Scene ${i}: 情绪跳跃过大 (${plan.emotionalArc[i-1]} → ${plan.emotionalArc[i]})，差 ${diff}`)
    }
  }
  coherenceScore = Math.max(0, coherenceScore)
  details.push(`情绪弧线连贯性: ${coherenceScore}/100`)

  // 1.2 因果链完整性
  const causalGraph = plan.narrativeLogic.causeEffectGraph
  const causalEdges = Array.isArray(causalGraph) ? (causalGraph as string[]).length : 0
  const nodeCount = plan.sceneSegmentation.length
  const causalRatio = nodeCount > 0 ? causalEdges / nodeCount : 0
  // 理想因果比：每个节点至少一条因果边
  if (causalRatio >= 2) {
    coherenceScore = Math.min(100, coherenceScore + 10)
    details.push(`因果链丰富: ${causalEdges} edges / ${nodeCount} nodes (ratio=${causalRatio.toFixed(2)})`)
  } else if (causalRatio < 1) {
    coherenceScore -= 15
    details.push(`因果链不足: ${causalEdges} edges / ${nodeCount} nodes (ratio=${causalRatio.toFixed(2)})`)
  } else {
    details.push(`因果链适中: ${causalEdges} edges / ${nodeCount} nodes (ratio=${causalRatio.toFixed(2)})`)
  }

  return { score: coherenceScore, details }
}

// ── 2. Structural Stability（30%） ──

function scoreStructuralStability(plan: DirectorPlan): { score: number; details: string[] } {
  const details: string[] = []

  let stabilityScore = 100

  // 2.1 结构完整性（包含起始-高潮-结局）
  const sceneCount = plan.sceneSegmentation.length
  if (sceneCount < 3) {
    stabilityScore -= 30
    details.push(`场景段不足: ${sceneCount}（最低需要 3 段）`)
  } else if (sceneCount > 12) {
    stabilityScore -= 10
    details.push(`场景段过多: ${sceneCount}（可能结构松散）`)
  } else {
    details.push(`场景段数量适中: ${sceneCount}`)
  }

  // 2.2 高潮位置合理性
  const climaxPos = plan.narrativeConstraints?.climaxPosition ?? 0.75
  if (climaxPos >= 0.5 && climaxPos <= 0.85) {
    stabilityScore += 5
    details.push(`高潮位置合理: ${Math.round(climaxPos * 100)}%`)
  } else {
    stabilityScore -= 10
    details.push(`高潮位置异常: ${Math.round(climaxPos * 100)}%（建议在 50%-85%）`)
  }

  // 2.3 narrativeLogic 完整性
  const logic = plan.narrativeLogic
  if (logic.causeEffectGraph && (logic.causeEffectGraph as unknown[]).length > 0) {
    details.push(`因果图存在: ${(logic.causeEffectGraph as unknown[]).length} 条边`)
  } else {
    stabilityScore -= 10
    details.push('因果图缺失')
  }
  if (logic.tensionFlow) {
    details.push(`张力流存在: ${logic.tensionFlow}`)
  } else {
    stabilityScore -= 10
    details.push('张力流缺失')
  }
  if (logic.pacingModel) {
    details.push(`节奏模型存在: ${logic.pacingModel}`)
  } else {
    stabilityScore -= 10
    details.push('节奏模型缺失')
  }

  stabilityScore = Math.max(0, Math.min(100, stabilityScore))
  details.push(`结构稳定性总分: ${stabilityScore}/100`)

  return { score: stabilityScore, details }
}

// ── 3. Execution Fidelity（30%） ──

function scoreExecutionFidelity(
  plan: DirectorPlan,
  blueprint?: VideoBlueprint
): { score: number; details: string[] } {
  const details: string[] = []

  // 对于没有 blueprint 的评估，以 plan 本身质量为准
  if (!blueprint) {
    let fidelityScore = 80
    details.push('无 Blueprint 输入，基于 DirectorPlan 质量评估')

    // 场景段都有 summary
    const allHaveSummary = plan.sceneSegmentation.every(s => s.summary && s.summary.length > 0)
    if (!allHaveSummary) {
      fidelityScore -= 20
      details.push('部分场景段缺少 summary')
    } else {
      fidelityScore += 10
      details.push('所有场景段都有 summary')
    }

    fidelityScore = Math.min(100, fidelityScore)
    return { score: fidelityScore, details }
  }

  // 有 blueprint：检查 compile 忠实度
  let fidelityScore = 100

  // 3.1 shotGraph 是否生成
  if (blueprint.shotGraph?.shots && blueprint.shotGraph.shots.length > 0) {
    fidelityScore += 5
    details.push(`ShotGraph 存在: ${blueprint.shotGraph.shots.length} shots`)
  } else {
    fidelityScore -= 20
    details.push('ShotGraph 缺失')
  }

  // 3.2 promptSpec 是否生成
  if (blueprint.promptSpec) {
    fidelityScore += 5
    details.push('PromptSpec 存在')
  } else {
    fidelityScore -= 15
    details.push('PromptSpec 缺失')
  }

  // 3.3 effectSpecs 是否生成
  if (blueprint.effectSpecs && blueprint.effectSpecs.length > 0) {
    fidelityScore += 5
    details.push(`EffectSpecs 存在: ${blueprint.effectSpecs.length} 个特效`)
  } else {
    fidelityScore -= 10
    details.push('EffectSpecs 缺失')
  }

  // 3.4 shot 数量是否合理
  if (blueprint.shotGraph?.shots) {
    const shotCount = blueprint.shotGraph.shots.length
    const sceneCount = plan.sceneSegmentation.length
    if (shotCount < sceneCount) {
      fidelityScore -= 15
      details.push(`Shot 数量(${shotCount}) < 场景段数(${sceneCount})，可能丢失内容`)
    } else if (shotCount > sceneCount * 3) {
      fidelityScore -= 5
      details.push(`Shot 数量(${shotCount}) 远多于场景段数(${sceneCount})，可能过于细化`)
    } else {
      fidelityScore += 5
      details.push(`Shot/Scene 比例合理: ${shotCount} shots / ${sceneCount} scenes`)
    }
  }

  fidelityScore = Math.max(0, Math.min(100, fidelityScore))
  details.push(`执行忠实度总分: ${fidelityScore}/100`)

  return { score: fidelityScore, details }
}

// ── 主评分函数 ──

const WEIGHTS = {
  narrativeCoherence: 0.40,
  structuralStability: 0.30,
  executionFidelity: 0.30,
}

/**
 * evaluateCreativeValue — 评估创作价值
 *
 * 这是 Phase 7 的核心价值函数。
 * 所有评分基于结构质量，禁止使用 engagement metrics。
 */
export function evaluateCreativeValue(
  plan: DirectorPlan,
  blueprint?: VideoBlueprint
): CreativeValueScore {
  const narrativeCoherence = scoreNarrativeCoherence(plan)
  const structuralStability = scoreStructuralStability(plan)
  const executionFidelity = scoreExecutionFidelity(plan, blueprint)

  const total =
    narrativeCoherence.score * WEIGHTS.narrativeCoherence +
    structuralStability.score * WEIGHTS.structuralStability +
    executionFidelity.score * WEIGHTS.executionFidelity

  // 评级
  let grade: CreativeValueScore['grade']
  if (total >= 90) grade = 'S'
  else if (total >= 75) grade = 'A'
  else if (total >= 60) grade = 'B'
  else if (total >= 40) grade = 'C'
  else grade = 'F'

  return {
    total: Math.round(total),
    dimensions: {
      narrativeCoherence: {
        score: narrativeCoherence.score,
        weight: WEIGHTS.narrativeCoherence,
        details: narrativeCoherence.details,
      },
      structuralStability: {
        score: structuralStability.score,
        weight: WEIGHTS.structuralStability,
        details: structuralStability.details,
      },
      executionFidelity: {
        score: executionFidelity.score,
        weight: WEIGHTS.executionFidelity,
        details: executionFidelity.details,
      },
    },
    grade,
  }
}
