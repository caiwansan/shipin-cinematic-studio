/**
 * Scenario Simulator v4 — 版本级预演模拟
 *
 * 对每个 scenario 做完整的演出效果模拟。
 * 规则引擎，不调 LLM。
 */

import { Scenario } from './scenario-generator.js'

export interface ScenarioSimulationResult {
  scenarioId: string
  successScore: number       // 0-1
  audienceEngagement: number // 0-1
  emotionalPeakStrength: number
  emotionalPeakEpisode: number
  coherenceScore: number     // 0-1
  pacingScore: number        // 0-1
  riskFlags: string[]
  audienceFatigueRisk: number // 0-1
}

export class ScenarioSimulator {
  simulate(scenario: Scenario): ScenarioSimulationResult {
    const riskFlags: string[] = []

    // 1. 情绪峰谷分析
    const peaks = scenario.emotionCurve.map((v, i) => ({ value: Math.abs(v), idx: i }))
      .sort((a, b) => b.value - a.value)
    const strongestPeak = peaks[0]
    const emotionalPeakStrength = strongestPeak.value
    const emotionalPeakEpisode = strongestPeak.idx + 1

    // 2. 观众参与度 — 情绪起伏 + 张力混合
    const emotionVariation = scenario.emotionCurve.reduce((sum, v, i) => {
      if (i === 0) return 0
      return sum + Math.abs(v - scenario.emotionCurve[i - 1])
    }, 0) / (scenario.emotionCurve.length - 1)

    const avgTension = scenario.tensionCurve.reduce((a, b) => a + b, 0) / scenario.tensionCurve.length
    const audienceEngagement = Math.round(
      Math.min(1, (emotionVariation * 0.5 + avgTension * 0.5) * 1.2) * 100
    ) / 100

    // 3. 一致性评分 — 情绪曲线是否平滑
    const smoothness = scenario.emotionCurve.reduce((sum, v, i) => {
      if (i < 2) return sum
      return sum + Math.abs(v - (scenario.emotionCurve[i - 1] + scenario.emotionCurve[i - 2]) / 2)
    }, 0) / scenario.emotionCurve.length
    const coherenceScore = Math.round(Math.max(0, Math.min(1, 1 - smoothness * 0.5)) * 100) / 100

    // 4. 节奏评分 — 张力曲线是否有节奏感
    const tensionPattern = scenario.tensionCurve.reduce((sum, v, i) => {
      if (i === 0) return 0
      return sum + Math.abs(v - scenario.tensionCurve[i - 1])
    }, 0) / (scenario.tensionCurve.length - 1)
    const pacingScore = Math.round(Math.min(1, tensionPattern * 2) * 100) / 100

    // 5. 观众疲劳风险 — 张力持续过高
    const highTensionEpisodes = scenario.tensionCurve.filter(t => t > 0.8).length
    const audienceFatigueRisk = Math.round(
      Math.min(1, highTensionEpisodes / scenario.tensionCurve.length * 2) * 100
    ) / 100

    // 6. 综合成功率
    const successScore = Math.round(
      (audienceEngagement * 0.3 + coherenceScore * 0.3 + pacingScore * 0.2 + (1 - scenario.riskLevel) * 0.2) * 100
    ) / 100

    // 7. 风险标记
    if (audienceFatigueRisk > 0.3) riskFlags.push('观众疲劳风险（张力持续过高）')
    if (coherenceScore < 0.4) riskFlags.push('情绪一致性偏低')
    if (emotionVariation < 0.2) riskFlags.push('情绪变化过平')
    if (scenario.riskLevel > 0.6) riskFlags.push('高风险路线')

    return {
      scenarioId: scenario.id,
      successScore,
      audienceEngagement,
      emotionalPeakStrength,
      emotionalPeakEpisode,
      coherenceScore,
      pacingScore,
      riskFlags,
      audienceFatigueRisk,
    }
  }
}

export const scenarioSimulator = new ScenarioSimulator()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow-jobs",
  "mode": "SHADOW"
};

