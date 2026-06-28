/**
 * optimization/experiments.ts — A/B 实验系统
 *
 * 对不同 provider、路由策略进行 A/B 测试，
 * 自动选择最优配置。
 */

interface ExperimentConfig {
  name: string
  description: string
  trafficPercent: number   // 分流比例 0~100
  enabled: boolean
  variants: ExperimentVariant[]
}

interface ExperimentVariant {
  name: string
  weight: number          // 权重（总和=1）
  provider: string
  config: Record<string, any>
}

interface ExperimentResult {
  variant: string
  requests: number
  successRate: number
  avgLatency: number
  avgCost: number
  score: number
}

const experiments = new Map<string, ExperimentConfig>()

// 历史实验结果
const experimentResults = new Map<string, ExperimentResult[]>()

/**
 * 注册一个实验
 */
export function registerExperiment(config: ExperimentConfig) {
  experiments.set(config.name, config)
}

/**
 * 根据实验获取当前请求的 provider
 */
export function selectProviderFromExperiment(experimentName: string): {
  variant: string
  provider: string
  config: Record<string, any>
} | null {
  const exp = experiments.get(experimentName)
  if (!exp || !exp.enabled) return null

  // 按权重随机选择变体
  const rand = Math.random()
  let cumulative = 0
  for (const variant of exp.variants) {
    cumulative += variant.weight
    if (rand <= cumulative) {
      return {
        variant: variant.name,
        provider: variant.provider,
        config: variant.config,
      }
    }
  }

  return null
}

/**
 * 记录一次实验结果
 */
export function recordExperimentResult(
  experimentName: string,
  variant: string,
  success: boolean,
  latency: number,
  cost: number
) {
  const key = `${experimentName}:${variant}`
  if (!experimentResults.has(key)) {
    experimentResults.set(key, [])
  }

  const results = experimentResults.get(key)!
  results.push({
    variant,
    requests: 1,
    successRate: success ? 1 : 0,
    avgLatency: latency,
    avgCost: cost,
    score: 0,
  })

  // 限制长度
  if (results.length > 500) results.shift()
}

/**
 * 获取实验结果分析
 */
export function getExperimentResults(): Record<string, {
  variants: ExperimentResult[]
  winner: string | null
  confidence: number
}> {
  const output: Record<string, any> = {}

  for (const [expName, exp] of experiments) {
    const variants: ExperimentResult[] = []

    for (const variant of exp.variants) {
      const key = `${expName}:${variant.name}`
      const results = experimentResults.get(key) || []
      if (results.length === 0) {
        variants.push({
          variant: variant.name,
          requests: 0,
          successRate: 0,
          avgLatency: 0,
          avgCost: 0,
          score: 0,
        })
        continue
      }

      const total = results.length
      const avgLatency = results.reduce((s, r) => s + r.avgLatency, 0) / total
      const avgCost = results.reduce((s, r) => s + r.avgCost, 0) / total
      const successRate = results.reduce((s, r) => s + r.successRate, 0) / total

      // 综合评分
      const latencyScore = Math.max(0, 1 - avgLatency / 30000)
      const score = successRate * 0.5 + latencyScore * 0.3 + (1 - avgCost / 0.05) * 0.2

      variants.push({
        variant: variant.name,
        requests: total,
        successRate: Math.round(successRate * 100) / 100,
        avgLatency: Math.round(avgLatency),
        avgCost: Math.round(avgCost * 10000) / 10000,
        score: Math.round(score * 100) / 100,
      })
    }

    // 选出胜者
    variants.sort((a, b) => b.score - a.score)
    const winner = variants[0].requests > 20 ? variants[0].variant : null

    output[expName] = {
      variants,
      winner,
      confidence: Math.min(1, variants.reduce((s, v) => s + v.requests, 0) / 100),
    }
  }

  return output
}
