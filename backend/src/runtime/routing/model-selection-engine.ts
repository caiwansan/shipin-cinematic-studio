/**
 * model-selection-engine.ts — 确定性模型选择引擎
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase 1 — Layer 2: Deterministic Rule Engine
 * Phase 2.1 — Weight Integration: latency + cost 注入评分
 *
 * 宪法（不可违反）:
 *   1. 纯确定性：相同输入永远输出相同结果
 *   2. 无 AI：禁止 LLM / ML / 自适应学习
 *   3. 静态权重：所有权重来自配置且只在启动时加载
 *   4. 严禁运行时权重调整
 *   5. 可解释：每个决策输出完整评分分解
 *
 * 调用者：
 *   provider-middleware.ts（编排层）→ model-selection-engine.ts（决策层）
 * ═══════════════════════════════════════════════════════════════
 */

import type { ResolvedModelRoute } from '../../services/provider-registry.service.js'
import { getMetrics } from './routing-metrics-store.js'
import type { ProviderMetricsWindow } from './routing-signal.js'
import { getProviderHealth } from './routing-metrics-store.js'

// ─── 静态权重配置（Phase 2.1 — 仅启动时加载，禁止运行时修改） ─────
interface WeightConfig {
  priorityWeight: number
  capabilityWeight: number
  latencyPenalty: number
  costPenalty: number
}

// ═══════════════════════════════════════════════════════════════
// Phase 2.1 — 静态权重配置
// ⚠️ 所有权重来自编译时常量，禁止运行时调整
// 调整权重 → 修改本文件或 routing-weight-config.json 后重启
// ═══════════════════════════════════════════════════════════════
const WEIGHT_CONFIG: WeightConfig = {
  priorityWeight: 0.6,
  capabilityWeight: 0.3,
  latencyPenalty: 0.05,
  costPenalty: 0.05,
}

console.log('[ModelSelectionEngine] 权重配置已加载:', JSON.stringify(WEIGHT_CONFIG))

// ─── 类型 ─────────────────────────────────────────────────────────

export interface RouteCandidate {
  providerName: string
  priority: number
  capabilities: string[]
  fallback: string[]
  limits: Record<string, unknown>
}

export interface SelectionContext {
  modelName: string
  requiredCapability: string   // 'llm' | 'image' | 'video' | 'tts'
}

export interface ScoreBreakdown {
  priority: number           // 基础优先级贡献
  capability: number         // 能力匹配贡献
  fallbackPenalty: number    // fallback 链惩罚
  latencyContribution: number // Phase 2.1 — 延迟信号贡献
  costContribution: number   // Phase 2.1 — 成本信号贡献
}

export interface SelectionScore {
  providerName: string
  total: number
  breakdown: ScoreBreakdown
}

export interface SelectionResult {
  selected: RouteCandidate
  candidates: Array<{ candidate: RouteCandidate; score: SelectionScore }>
  reason: string               // 可读解释
  source: 'db' | 'legacy' | 'shim'
}

// ─── 核心引擎 ─────────────────────────────────────────────────────

/**
 * 从候选 provider 列表中选出最优 provider
 *
 * 确定性规则（完全静态权重）:
 *   score = priorityWeight * priority
 *         + capabilityWeight * capabilityMatch
 *         - latencyPenalty * normalizedLatency
 *         - costPenalty * normalizedCost
 *         + fallbackPenalty
 *
 * @param candidates 候选 provider 列表（来自 DB 或 legacy）
 * @param context 请求上下文（模型名 + 所需能力）
 * @returns 最优选择的详细结果（含打分分解和 reason）
 */
export function selectRoute(
  candidates: RouteCandidate[],
  context: SelectionContext
): SelectionResult {
  if (candidates.length === 0) {
    throw new Error(`[ModelSelectionEngine] 无可用的 provider 候选（model=${context.modelName}）`)
  }

  const w = WEIGHT_CONFIG

  const scores: Array<{ candidate: RouteCandidate; score: SelectionScore }> = []

  for (const candidate of candidates) {
    const breakdown = computeScore(candidate, context, w)
    scores.push({ candidate, score: breakdown })
  }

  // 按总分降序排列
  scores.sort((a, b) => b.score.total - a.score.total)

  const best = scores[0]
  const reason = buildReason(best, context, w)

  return {
    selected: best.candidate,
    candidates: scores,
    reason,
    source: 'db', // 由调用方覆写
  }
}

// ─── 打分引擎（Phase 2.1: 信号感知版） ──────────────────────────

function computeScore(
  candidate: RouteCandidate,
  context: SelectionContext,
  w: WeightConfig
): SelectionScore {
  // 基础优先级分 (0-100，归一化)
  const priorityNorm = normalizePriority(candidate.priority)

  // 能力匹配分 (0-100)
  const capabilityNorm = computeCapabilityScore(candidate.capabilities, context.requiredCapability)

  // fallback 链惩罚 (-10 per hop)
  const fallbackPenalty = candidate.fallback.length * 10

  // ── Phase 2.1: 实时信号注入（仅聚合数据，不链接回训练） ──
  const metrics = getMetrics(candidate.providerName)
  const latencyNorm = metrics ? normalizeLatency(metrics) : 0
  const costNorm = metrics ? normalizeCost(metrics) : 0

  // 最终得分（静态权重 x 归一化分）
  const total = Math.round(
    (priorityNorm * w.priorityWeight) +
    (capabilityNorm * w.capabilityWeight) -
    (latencyNorm * w.latencyPenalty) -
    (costNorm * w.costPenalty) +
    (fallbackPenalty * -0.10)  // fallback 惩罚保持 -10% 权重
  )

  return {
    providerName: candidate.providerName,
    total,
    breakdown: {
      priority: Math.round(priorityNorm * w.priorityWeight),
      capability: Math.round(capabilityNorm * w.capabilityWeight),
      fallbackPenalty: -fallbackPenalty,
      latencyContribution: Math.round(latencyNorm * w.latencyPenalty * -1),
      costContribution: Math.round(costNorm * w.costPenalty * -1),
    },
  }
}

// ─── 归一化函数 ──────────────────────────────────────────────────

/**
 * 归一化 priority（DB 中的 priority 范围通常 0-10，映射到 0-100）
 */
function normalizePriority(priority: number): number {
  return Math.min(100, Math.max(0, priority * 10))
}

/**
 * 能力匹配度打分（完全确定性）
 * - 完全匹配: 100
 * - 近似匹配: 80
 * - 不匹配: 0
 */
function computeCapabilityScore(
  capabilities: string[],
  required: string
): number {
  if (!required) return 50

  if (capabilities.includes(required)) return 100
  if (required === 'llm' && capabilities.includes('vision')) return 80
  if (required === 'vision' && capabilities.includes('llm')) return 80
  return 0
}

/**
 * 归一化延迟（0-100，越低越好）
 * p95=200ms → 20分，p95=10s → 100分
 * 公式: min(100, p95Ms / 20)
 */
function normalizeLatency(metrics: ProviderMetricsWindow): number {
  return Math.min(100, Math.round(metrics.p95LatencyMs / 20))
}

/**
 * 归一化成本（0-100，越低越好）
 * avgCost=0.01 → 10分，avgCost=0.1 → 100分
 * 公式: min(100, avgCostUsd * 1000)
 */
function normalizeCost(metrics: ProviderMetricsWindow): number {
  return Math.min(100, Math.round(metrics.avgCostUsd * 1000))
}

/**
 * 构建可读的决策解释（Phase 2.1: 含信号贡献）
 */
function buildReason(
  best: { candidate: RouteCandidate; score: SelectionScore },
  context: SelectionContext,
  w: WeightConfig
): string {
  const { providerName } = best.candidate
  const { breakdown } = best.score
  const total = best.score.total

  // Phase 2.2 — Provider Health观测（不参与决策，只打印）
  const health = getProviderHealth(providerName)
  if (health) {
    console.log(
      `[Health] provider=${providerName} health=${health.healthScore} ` +
      `success=${health.successRate} error=${health.errorRate} ` +
      `samples=${health.sampleSize}`
    )
  }

  const parts: string[] = [
    `选 "${providerName}" (总分 ${total})`,
    `优先级 ${breakdown.priority} (权重 ${w.priorityWeight})`,
    `能力匹配 ${breakdown.capability} (权重 ${w.capabilityWeight})`,
  ]

  if (breakdown.latencyContribution < 0) {
    parts.push(`延迟惩罚 ${breakdown.latencyContribution} (权重 ${w.latencyPenalty})`)
  }
  if (breakdown.costContribution < 0) {
    parts.push(`成本惩罚 ${breakdown.costContribution} (权重 ${w.costPenalty})`)
  }
  if (breakdown.fallbackPenalty < 0) {
    parts.push(`fallback 惩罚 ${breakdown.fallbackPenalty}`)
  }

  return parts.join(' | ')
}

// ─── 辅助函数 ─────────────────────────────────────────────────────

/**
 * 从 ResolvedModelRoute 转为 RouteCandidate（DB 路由）
 */
export function toCandidate(route: ResolvedModelRoute): RouteCandidate {
  return {
    providerName: route.providerName,
    priority: route.priority ?? 0,
    capabilities: route.capabilities ?? [],
    fallback: route.fallback ?? [],
    limits: route.limits ?? {},
  }
}

/**
 * 从 candidate 列表展开 fallback 链
 */
export function expandFallbackChain(
  primary: RouteCandidate,
  allProviders: RouteCandidate[]
): RouteCandidate[] {
  const result: RouteCandidate[] = [primary]
  for (const fallbackName of primary.fallback) {
    const fb = allProviders.find(p => p.providerName === fallbackName)
    if (fb && !result.find(r => r.providerName === fb.providerName)) {
      result.push(fb)
    }
  }
  return result
}

export default { selectRoute, toCandidate, expandFallbackChain }
