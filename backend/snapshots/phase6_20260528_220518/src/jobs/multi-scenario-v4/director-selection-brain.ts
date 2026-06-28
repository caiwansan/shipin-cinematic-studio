/**
 * Director Selection Brain v4 — 导演选择系统
 *
 * 基于 Intent + Scenario Scores 做出最终选择。
 * 模拟真实导演的决策逻辑。
 */

import { IntentProfile } from '../intent-engine-v3/index.js'
import { Scenario } from './scenario-generator.js'
import { ScenarioScore } from './scenario-evaluator.js'

export interface DirectorSelection {
  selectedScenarioId: string
  reason: string
  runnerUp: { id: string; score: number; reason: string }
  selectionConfidence: number  // 0-1

  // 决策分析
  scores: ScenarioScore[]
  decisionFactors: string[]
}

export class DirectorSelectionBrain {
  select(
    scenarios: Scenario[],
    scores: ScenarioScore[],
    intentProfile: IntentProfile,
  ): DirectorSelection {
    const decisionFactors: string[] = []
    const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore)

    const top = sorted[0]
    const second = sorted[1]

    // 选择理由
    let primaryReason = ''

    // 根据意图类型做偏好调整
    if (intentProfile.classification.intentType === 'concept') {
      // concept: 选情绪冲击力 + 节奏最好的
      const conceptPick = scores.reduce((best, curr) => {
        const score = curr.dimensions.emotionalImpact * 0.5 + curr.dimensions.pacingQuality * 0.3 + curr.dimensions.commercialViability * 0.2
        return score > best.score ? { scenario: curr, score } : best
      }, { scenario: scores[0], score: 0 })
      primaryReason = `概念输入优先选择情绪冲击力最强的版本：${conceptPick.scenario.scenarioType}路线 (评分 ${(conceptPick.score * 100).toFixed(0)}分)`
      decisionFactors.push(`意图类型：concept → 偏好 emotional × pacing`)
    } else if (intentProfile.classification.intentType === 'full_story') {
      // full_story: 一致性第一
      const storyPick = scores.reduce((best, curr) => {
        const score = curr.dimensions.narrativeCoherence * 0.5 + curr.dimensions.riskScore * 0.3 + curr.dimensions.commercialViability * 0.2
        return score > best.score ? { scenario: curr, score } : best
      }, { scenario: scores[0], score: 0 })
      primaryReason = `完整故事优先保留叙事一致性：${storyPick.scenario.scenarioType}路线 (评分 ${(storyPick.score * 100).toFixed(0)}分)`
      decisionFactors.push(`意图类型：full_story → 偏好 coherence × risk`)
    } else {
      // 默认：综合评分最高
      primaryReason = `综合评分最高：${top.scenarioType}路线 (${(top.totalScore * 100).toFixed(0)}分)`
      decisionFactors.push(`综合评分排名：${scores.map(s => `${s.scenarioType}=${(s.totalScore * 100).toFixed(0)}`).join(', ')}`)
    }

    // Runner up
    const runnerUpReason = `第二选择：${second.scenarioType}路线 (${(second.totalScore * 100).toFixed(0)}分)，${top.totalScore - second.totalScore > 0.1 ? '与第一名差距显著' : '与第一名差距较小，可作为备选'}`

    // 选择置信度
    const scoreGap = top.totalScore - second.totalScore
    const selectionConfidence = Math.round(Math.min(1, 0.5 + scoreGap * 2) * 100) / 100

    // 额外决策因素
    const bestScenario = scenarios.find(s => s.id === top.scenarioId)
    if (bestScenario) {
      decisionFactors.push(`目标受众：${bestScenario.targetAudience}`)
      decisionFactors.push(`核心卖点：${bestScenario.keyAppeal}`)
    }

    return {
      selectedScenarioId: top.scenarioId,
      reason: primaryReason,
      runnerUp: {
        id: second.scenarioId,
        score: second.totalScore,
        reason: runnerUpReason,
      },
      selectionConfidence,
      scores,
      decisionFactors,
    }
  }
}

export const directorSelectionBrain = new DirectorSelectionBrain()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow-jobs",
  "mode": "SHADOW"
};

