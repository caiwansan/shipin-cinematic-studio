/**
 * director-intelligence/convergence-engine.ts
 *
 * ⚔️ Phase 3.5 — Convergence Engine（收敛引擎）
 *
 * 职责：
 *   多个 DirectorPlan → 收敛为 1 个 stable Blueprint candidate
 *
 * 为什么需要：
 *   Phase 3 引入多样性（发散），但 Blueprint Compiler 只能接受单输入。
 *   如果不收敛，Phase 4 的 Multi-Director × Style 将指数级膨胀。
 *
 * 评分维度（规则化，不引入 AI）：
 *   1. narrativeCoherence — 叙事连贯性
 *   2. emotionalStability — 情绪稳定性
 *   3. causalClarity — 因果清晰度
 *   4. structureCompleteness — 结构完整度
 *   5. blueprintCompatibilityRisk — Blueprint 兼容风险
 */

import type { DirectorPlan } from '../director-runtime/types.js'

// ── 评分结果 ──

export interface ScoreResult {
  narrativeCoherence: number    // 0-1
  emotionalStability: number    // 0-1
  causalClarity: number         // 0-1
  structureCompleteness: number // 0-1
  blueprintCompatibilityRisk: number // 0-1（越低越好）
  total: number                 // 加权总分
}

export interface ConvergenceResult {
  /** 被选中的 plan */
  selected: DirectorPlan
  /** 所有候选 plan 及其评分 */
  candidates: Array<{
    plan: DirectorPlan
    score: ScoreResult
    ranking: number
  }>
  /** 评分最高的 plan（可能在多个维度上不如 selected） */
  highestScore: DirectorPlan
  /** 收敛决策说明 */
  rationale: string
}

// ── 评分权重 ──

const WEIGHTS = {
  narrativeCoherence: 0.30,
  emotionalStability: 0.20,
  causalClarity: 0.25,
  structureCompleteness: 0.15,
  blueprintCompatibilityRisk: -0.10, // 负权重：风险越低越好
}

// ── 评分函数 ──

/**
 * scorePlan — 对单个 DirectorPlan 进行多维度评分
 *
 * 评分规则（纯算法，不涉及语义理解）：
 *
 * narrativeCoherence: 情绪弧线平缓度
 *   - 相邻情绪之间的差异越小 → 越连贯
 *   - 差异越大 → 情绪跳跃 → 不连贯
 *
 * emotionalStability: 情绪波动稳定度
 *   - 情绪弧线接近典型叙事曲线 → 越稳定
 *
 * causalClarity: 因果链清晰度
 *   - 因果边越多 → 越清晰
 *   - 边数/节点数 比例高 → 高清晰度
 *
 * structureCompleteness: 结构完整度
 *   - sceneSegmentation 覆盖完整的高潮-发展-结局
 *
 * blueprintCompatibilityRisk: Blueprint 兼容风险
 *   - 场景段数量在合理范围（3-8）→ 低风险
 *   - 场景段过多或过少 → 高风险
 */
export function scorePlan(plan: DirectorPlan): ScoreResult {
  const scenes = plan.sceneSegmentation
  const graph = plan.narrativeGraph
  const arc = plan.emotionalArc
  const constraints = plan.narrativeConstraints

  // 1. narrativeCoherence — 情绪弧线平缓度
  // 相邻情绪变化越大，连贯性越低
  let coherenceScore = 1.0
  if (arc.length >= 2) {
    const changes = arc.slice(0, -1).map((_, i) => {
      const e1 = getEmotionIntensity(arc[i])
      const e2 = getEmotionIntensity(arc[i + 1])
      return Math.abs(e1 - e2)
    })
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length
    coherenceScore = Math.max(0, 1 - avgChange * 0.3)
  }

  // 2. emotionalStability — 情绪波动稳定度
  // 检查情绪弧线是否包含常见叙事曲线模式
  let stabilityScore = 0.7
  if (arc.length >= 3) {
    const intensities = arc.map(getEmotionIntensity)
    // 理想的叙事曲线：低→高→更高→中→高
    // 检查是否有明显的 tension build-up
    const hasClimax = intensities.some((v, i) => {
      if (i === 0 || i === intensities.length - 1) return false
      const prev = intensities[i - 1]
      const next = intensities[i + 1]
      return v > prev && v > next // 局部峰值
    })
    if (hasClimax) stabilityScore += 0.15

    // 检查 constrains 中的 climaxPosition
    if (constraints?.climaxPosition && constraints.climaxPosition > 0.3 && constraints.climaxPosition < 0.95) {
      stabilityScore += 0.15
    }
  }
  stabilityScore = Math.min(1, stabilityScore)

  // 3. causalClarity — 因果清晰度
  const edgeCount = graph?.edges?.length ?? 1
  const nodeCount = graph?.nodes?.length ?? 1
  const causalRatio = edgeCount / Math.max(nodeCount, 1)
  // 理想比值在 0.5-1.0 之间
  const clarityScore = Math.min(1, causalRatio > 0.3 ? causalRatio * 0.8 : 0.3)

  // 4. structureCompleteness — 结构完整度
  let structScore = 0.5
  if (scenes.length >= 2) structScore += 0.15
  if (scenes.length >= 3) structScore += 0.15
  if (scenes.length <= 8) structScore += 0.1
  // 检查场景段涵盖起始-发展-结束
  const purposes = scenes.map(s => s.narrativePurpose)
  const hasStart = purposes.some(p => p.includes('开场') || p.includes('建立') || p.includes('相遇') || p.includes('日常') || p.includes('出发'))
  const hasClimax = purposes.some(p => p.includes('转折') || p.includes('高潮') || p.includes('危机') || p.includes('冲突') || p.includes('对抗'))
  const hasEnd = purposes.some(p => p.includes('结局') || p.includes('升华') || p.includes('释然') || p.includes('希望') || p.includes('思考'))
  if (hasStart) structScore += 0.1
  if (hasClimax) structScore += 0.1
  if (hasEnd) structScore += 0.1
  structScore = Math.min(1, structScore)

  // 5. blueprintCompatibilityRisk — Blueprint 兼容风险
  let riskScore = 0
  // 场景段偏离 3-8 范围 → 高风险
  if (scenes.length < 2 || scenes.length > 10) riskScore += 0.4
  if (scenes.length < 3 || scenes.length > 8) riskScore += 0.2
  // 因果链缺失 → 高风险
  if (!plan.narrativeLogic?.causeEffectGraph?.length) riskScore += 0.3
  // 情绪弧线太短 → 高风险
  if (arc.length < 2) riskScore += 0.3
  riskScore = Math.min(1, riskScore)

  // 加权总分
  const total = (
    coherenceScore * WEIGHTS.narrativeCoherence +
    stabilityScore * WEIGHTS.emotionalStability +
    clarityScore * WEIGHTS.causalClarity +
    structScore * WEIGHTS.structureCompleteness +
    (1 - riskScore) * (-WEIGHTS.blueprintCompatibilityRisk) // 注意：负权重在这里处理
  )

  return {
    narrativeCoherence: round(coherenceScore),
    emotionalStability: round(stabilityScore),
    causalClarity: round(clarityScore),
    structureCompleteness: round(structScore),
    blueprintCompatibilityRisk: round(riskScore),
    total: round(total),
  }
}

// ── 收敛执行 ──

/**
 * convergePlans — 多 DirectorPlan 收敛为 1 个
 *
 * 收敛策略：
 *   1. 按总分排序
 *   2. 选择最高分 plan
 *   3. 生成收敛说明
 */
export function convergePlans(plans: DirectorPlan[]): ConvergenceResult {
  if (plans.length === 0) {
    throw new Error('[CONVERGENCE_ENGINE] 无候选 plan 可收敛')
  }

  // 对每个 plan 评分
  const scored = plans.map(plan => ({
    plan,
    score: scorePlan(plan),
  }))

  // 按总分排序（降序）
  scored.sort((a, b) => b.score.total - a.score.total)

  // 赋值 ranking
  const candidates = scored.map((item, idx) => ({
    ...item,
    ranking: idx + 1,
  }))

  // 选择最高分 plan
  const selected = candidates[0]
  const highestScore = candidates[0].plan

  // 生成收敛说明
  const rationale = buildRationale(selected, candidates)

  return {
    selected: selected.plan,
    candidates: candidates,
    highestScore,
    rationale,
  }
}

// ── 工具函数 ──

/**
 * getEmotionIntensity — 情绪强度映射
 *
 * 将情绪标签映射为数值强度（0-1），
 * 用于计算情绪弧线的平缓度。
 */
const EMOTION_INTENSITY: Record<string, number> = {
  '平静': 0.1, '安宁': 0.1, '淡然': 0.1, '安逸': 0.1,
  '期待': 0.2, '好奇': 0.2, '孤独': 0.2, '暗涌': 0.2,
  '疑惑': 0.3, '不安': 0.3, '心动': 0.3, '兴奋': 0.3,
  '波动': 0.4, '甜蜜': 0.4, '紧张': 0.4, '恐惧': 0.4,
  '感动': 0.4, '悲壮': 0.5,
  '挣扎': 0.6, '矛盾': 0.6, '危机': 0.6, '震惊': 0.6,
  '转折': 0.7, '高潮': 0.8,
  '突破': 0.7, '抉择': 0.7,
  '释然': 0.3, '升华': 0.3, '思考': 0.2, '收束': 0.2,
  '希望': 0.2, '成就': 0.2, '温暖': 0.2,
}

function getEmotionIntensity(emotion: string): number {
  // 精确匹配
  const exact = EMOTION_INTENSITY[emotion]
  if (exact !== undefined) return exact

  // 子字符串匹配
  for (const [key, value] of Object.entries(EMOTION_INTENSITY)) {
    if (emotion.includes(key)) return value
  }

  return 0.5 // 未知情绪，取中间值
}

function round(value: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

function buildRationale(
  selected: { plan: DirectorPlan; score: ScoreResult; ranking: number },
  candidates: ConvergenceResult['candidates']
): string {
  const parts: string[] = []

  parts.push(`选中的 plan (Rank ${selected.ranking})：`)
  parts.push(`  意图: ${selected.plan.narrativeIntent.substring(0, 30)}...`)
  parts.push(`  场景: ${selected.plan.sceneSegmentation.length}段`)
  parts.push(`  节奏: ${selected.plan.narrativeConstraints?.pacing ?? 'normal'}`)
  parts.push(`  总分: ${selected.score.total}`)
  parts.push('')

  const breakdown = []
  if (selected.score.narrativeCoherence >= 0.7) breakdown.push('叙事连贯✓')
  if (selected.score.emotionalStability >= 0.7) breakdown.push('情绪稳定✓')
  if (selected.score.causalClarity >= 0.6) breakdown.push('因果清晰✓')
  if (selected.score.structureCompleteness >= 0.7) breakdown.push('结构完整✓')
  if (selected.score.blueprintCompatibilityRisk <= 0.3) breakdown.push('兼容风险低✓')
  parts.push(`选择理由: ${breakdown.length > 0 ? breakdown.join(' ') : '综合评分最高'}`)

  if (candidates.length > 1) {
    const runnerUp = candidates[1]
    const diff = selected.score.total - runnerUp.score.total
    parts.push(`领先第二名: +${diff.toFixed(4)}分`)
  }

  return parts.join('\n')
}
