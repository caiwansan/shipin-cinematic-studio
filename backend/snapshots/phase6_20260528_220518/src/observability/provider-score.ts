/**
 * observability/provider-score.ts — Provider 性能评分系统
 *
 * 评分权重：
 * - 延迟 (40%): 响应越快分越高
 * - 成功率 (30%): 成功比例
 * - 成本效率 (20%): 性价比（低成本高效优先）
 * - 熔断状态 (10%): 健康 provider 加分
 *
 * 滚动窗口更新，用于 API Router 的自优化路由
 */

interface ProviderScore {
  provider: string
  score: number       // 0~1
  latencyScore: number
  successScore: number
  costScore: number
  circuitScore: number
  samples: number
  windowStart: number
}

const scores = new Map<string, ProviderScore>()

// 评分权重
const WEIGHTS = {
  latency: 0.40,
  success: 0.30,
  cost: 0.20,
  circuit: 0.10,
}

// 理想值参考
const IDEAL_LATENCY_MS = 3000      // 3s 以内为满分
const MAX_LATENCY_MS = 30_000      // 30s 以上为 0 分

/**
 * 计算 provider 评分
 */
export function calculateProviderScore(params: {
  provider: string
  avgLatency: number     // ms
  successRate: number    // 0~1
  costPerCall: number    // $
  circuitState: string   // HEALTHY / DEGRADED / OPEN / HALF_OPEN
}): number {
  // 延迟评分：越接近 IDEAL_LATENCY 越高
  const latencyScore = params.avgLatency <= IDEAL_LATENCY_MS ? 1
    : Math.max(0, 1 - (params.avgLatency - IDEAL_LATENCY_MS) / (MAX_LATENCY_MS - IDEAL_LATENCY_MS))

  // 成功率评分
  const successScore = params.successRate

  // 成本效率评分（最低成本 0.001$ 为满分 1）
  const costScore = Math.max(0, 1 - (params.costPerCall / 0.05))

  // 熔断状态评分
  const circuitScore =
    params.circuitState === 'HEALTHY' ? 1 :
    params.circuitState === 'DEGRADED' ? 0.5 :
    params.circuitState === 'HALF_OPEN' ? 0.3 : 0

  const total =
    latencyScore * WEIGHTS.latency +
    successScore * WEIGHTS.success +
    costScore * WEIGHTS.cost +
    circuitScore * WEIGHTS.circuit

  // 缓存
  scores.set(params.provider, {
    provider: params.provider,
    score: Math.round(total * 100) / 100,
    latencyScore: Math.round(latencyScore * 100) / 100,
    successScore: Math.round(successScore * 100) / 100,
    costScore: Math.round(costScore * 100) / 100,
    circuitScore: Math.round(circuitScore * 100) / 100,
    samples: 0,
    windowStart: Date.now(),
  })

  return total
}

/**
 * 更新评分（从 metrics 数据）
 */
export function updateProviderScore(
  provider: string,
  avgLatency: number,
  successRate: number,
  costPerCall: number,
  circuitState: string
): number {
  return calculateProviderScore({
    provider, avgLatency, successRate, costPerCall, circuitState,
  })
}

/**
 * 获取所有 provider 评分排名
 */
export function getProviderRanking(): ProviderScore[] {
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
}

/**
 * 获取最优 provider（最高评分）
 */
export function getBestProvider(exclude?: string[]): ProviderScore | undefined {
  return getProviderRanking()
    .filter(p => !exclude?.includes(p.provider))
    [0]
}
