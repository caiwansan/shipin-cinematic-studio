/**
 * Scenario Evaluator v4 — 版本评分器
 *
 * 多维度评分 + 加权聚合。
 */

import { Scenario } from './scenario-generator.js'
import { ScenarioSimulationResult } from './scenario-simulator.js'

export interface ScenarioScore {
  scenarioId: string
  scenarioType: string
  totalScore: number           // 0-1 综合评分
  dimensions: {
    emotionalImpact: number    // 0-1
    narrativeCoherence: number // 0-1
    commercialViability: number // 0-1
    riskScore: number          // 0-1 (越高越安全)
    pacingQuality: number      // 0-1
  }
}

export class ScenarioEvaluator {
  evaluate(scenario: Scenario, sim: ScenarioSimulationResult, intentStrength: number): ScenarioScore {
    // 1. emotionalImpact — 情绪峰值 + 变化强度
    const emotionalImpact = Math.round(
      (sim.emotionalPeakStrength * 0.5 + sim.audienceEngagement * 0.5) * 100
    ) / 100

    // 2. narrativeCoherence — 模拟的一致性评分
    const narrativeCoherence = sim.coherenceScore

    // 3. commercialViability — 受众广度 + 参与度
    const commercialViability = Math.round(
      (sim.audienceEngagement * 0.4 + (1 - scenario.riskLevel) * 0.3 + sim.pacingScore * 0.3) * 100
    ) / 100

    // 4. riskScore — 反向风险 (越高越安全)
    const riskScore = Math.round(Math.max(0, Math.min(1, 1 - scenario.riskLevel - sim.audienceFatigueRisk * 0.5)) * 100) / 100

    // 5. pacingQuality
    const pacingQuality = sim.pacingScore

    // 综合：根据意图类型加权
    let weights = { emotionalImpact: 0.25, narrativeCoherence: 0.25, commercialViability: 0.2, riskScore: 0.15, pacingQuality: 0.15 }

    // 弱输入 → emotionalImpact + pacingQuality 权重更高
    if (intentStrength < 0.3) {
      weights = { emotionalImpact: 0.35, narrativeCoherence: 0.15, commercialViability: 0.15, riskScore: 0.1, pacingQuality: 0.25 }
    }
    // 强输入 → narrativeCoherence 权重更高
    else if (intentStrength > 0.7) {
      weights = { emotionalImpact: 0.2, narrativeCoherence: 0.4, commercialViability: 0.15, riskScore: 0.15, pacingQuality: 0.1 }
    }

    const totalScore = Math.round(
      (emotionalImpact * weights.emotionalImpact +
       narrativeCoherence * weights.narrativeCoherence +
       commercialViability * weights.commercialViability +
       riskScore * weights.riskScore +
       pacingQuality * weights.pacingQuality) * 100
    ) / 100

    return {
      scenarioId: scenario.id,
      scenarioType: scenario.type,
      totalScore,
      dimensions: { emotionalImpact, narrativeCoherence, commercialViability, riskScore, pacingQuality },
    }
  }
}

export const scenarioEvaluator = new ScenarioEvaluator()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow-jobs",
  "mode": "SHADOW"
};

