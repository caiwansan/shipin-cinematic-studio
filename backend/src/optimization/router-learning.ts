/**
 * optimization/router-learning.ts — 自适应路由学习器
 *
 * 使用指数移动平均 (EMA) 持续更新 provider 评分
 * 评分公式: 延迟40% + 成功率30% + 成本效率20% + 稳定性10%
 *
 * 形成一个完整的反馈闭环：
 * 请求 → 结果 → Metrics → 评分更新 → 路由决策
 */

interface ProviderLearningState {
  provider: string
  latencyEMA: number        // 指数移动平均延迟
  successRateEMA: number    // EMA 成功率
  costEMA: number           // EMA 成本
  stabilityEMA: number      // EMA 稳定性（熔断次数）
  score: number             // 综合评分
  scoreHistory: number[]    // 最近 20 次评分
  updates: number           // 更新次数
  lastUpdated: number
}

// 各 provider 状态
const states = new Map<string, ProviderLearningState>()

// EMA 平滑因子
const ALPHA = 0.3   // 越近期权重越大
const SCORE_WINDOW = 20

// 评分权重
const WEIGHTS = {
  latency: 0.40,
  success: 0.30,
  cost: 0.20,
  stability: 0.10,
}

// 理想值
const IDEAL_LATENCY = 3000     // 3s
const MAX_LATENCY = 30_000     // 30s
const IDEAL_COST = 0.001       // $0.001
const MAX_COST = 0.05          // $0.05

/**
 * 初始化 provider 学习状态
 */
export function initProvider(provider: string) {
  if (!states.has(provider)) {
    states.set(provider, {
      provider,
      latencyEMA: IDEAL_LATENCY,
      successRateEMA: 1,
      costEMA: IDEAL_COST,
      stabilityEMA: 1,
      score: 0.8,
      scoreHistory: [],
      updates: 0,
      lastUpdated: Date.now(),
    })
  }
}

/**
 * 反馈一条请求结果 → 更新评分
 */
export function recordFeedback(params: {
  provider: string
  success: boolean
  latency: number
  cost: number
  circuitOpened: boolean           // 此次请求是否触发熔断
}): number {
  const { provider, success, latency, cost, circuitOpened } = params
  initProvider(provider)
  const s = states.get(provider)!

  // EMA 更新
  s.latencyEMA = ALPHA * latency + (1 - ALPHA) * s.latencyEMA
  s.successRateEMA = ALPHA * (success ? 1 : 0) + (1 - ALPHA) * s.successRateEMA
  s.costEMA = ALPHA * cost + (1 - ALPHA) * s.costEMA
  s.stabilityEMA = ALPHA * (circuitOpened ? 0.3 : 1) + (1 - ALPHA) * s.stabilityEMA

  // 重新计算综合评分
  const latencyScore = s.latencyEMA <= IDEAL_LATENCY ? 1
    : Math.max(0, 1 - (s.latencyEMA - IDEAL_LATENCY) / (MAX_LATENCY - IDEAL_LATENCY))
  const successScore = s.successRateEMA
  const costScore = Math.max(0, 1 - (s.costEMA / MAX_COST))
  const stabilityScore = s.stabilityEMA

  s.score =
    latencyScore * WEIGHTS.latency +
    successScore * WEIGHTS.success +
    costScore * WEIGHTS.cost +
    stabilityScore * WEIGHTS.stability

  s.score = Math.round(s.score * 10000) / 10000
  s.scoreHistory.push(s.score)
  if (s.scoreHistory.length > SCORE_WINDOW) s.scoreHistory.shift()
  s.updates++
  s.lastUpdated = Date.now()

  return s.score
}

/**
 * 获取 provider 的学习评分
 */
export function getProviderScore(provider: string): number {
  const s = states.get(provider)
  if (!s) return 0.5  // 新 provider 给默认分
  return s.score
}

/**
 * 获取所有 provider 学习状态（用于 API）
 */
export function getAllProviderStates() {
  return Array.from(states.values())
    .sort((a, b) => b.score - a.score)
    .map(s => ({
      provider: s.provider,
      score: s.score,
      latencyEMA: Math.round(s.latencyEMA),
      successRateEMA: Math.round(s.successRateEMA * 100) + '%',
      costEMA: '$' + s.costEMA.toFixed(4),
      stabilityEMA: Math.round(s.stabilityEMA * 100) + '%',
      updates: s.updates,
      scoreTrend: getScoreTrend(s),
    }))
}

/**
 * 获取评分趋势
 */
function getScoreTrend(s: ProviderLearningState): 'up' | 'down' | 'stable' {
  if (s.scoreHistory.length < 5) return 'stable'
  const recent = s.scoreHistory.slice(-5)
  const first = recent[0]
  const last = recent[recent.length - 1]
  const diff = last - first
  if (diff > 0.02) return 'up'
  if (diff < -0.02) return 'down'
  return 'stable'
}

/**
 * 重置 provider 学习
 */
export function resetProviderLearning(provider?: string) {
  if (provider) {
    states.delete(provider)
  } else {
    states.clear()
  }
}
