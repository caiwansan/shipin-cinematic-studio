/**
 * Intent Router v3 — 意图路由
 *
 * 将 Intent Classification + Strength + Elasticity 整合为 Worker 执行策略。
 */

import { IntentClassification, IntentClassifier, intentClassifier } from './intent-classifier.js'
import { IntentStrength, IntentStrengthAnalyzer, intentStrengthAnalyzer } from './intent-strength-analyzer.js'
import { ElasticityPolicy, NarrativeElasticityEngine, narrativeElasticityEngine } from './narrative-elasticity-engine.js'

export interface IntentProfile {
  classification: IntentClassification
  strength: IntentStrength
  elasticity: ElasticityPolicy
  summary: {
    type: string
    strength: number
    mode: string
    expansionLevel: number
  }
}

export class IntentRouter {
  route(input: string): IntentProfile {
    // Step 1: 意图分类
    const classification = intentClassifier.classify(input)

    // Step 2: 强度分析
    const strength = intentStrengthAnalyzer.analyze(
      input,
      input.length,
      classification.detectedEntities.length,
    )

    // Step 3: 弹性策略
    const elasticity = narrativeElasticityEngine.computePolicy(
      classification.intentType,
      strength,
    )

    return {
      classification,
      strength,
      elasticity,
      summary: {
        type: classification.intentType,
        strength: strength.intentStrength,
        mode: elasticity.mode,
        expansionLevel: elasticity.expansionLevel,
      },
    }
  }

  /**
   * 生成传给 Showrunner Worker 的辅助提示
   * 让 Worker 的各步骤知道该扩展多少
   */
  buildWorkerDirective(profile: IntentProfile): string {
    const { elasticity, classification } = profile

    let directive = [
      `【Intent Engine Directive】`,
      `输入类型: ${classification.intentType}`,
      `意图强度: ${profile.strength.intentStrength}`,
      `执行模式: ${elasticity.mode}`,
      `扩展级别: ${elasticity.expansionLevel}/10`,
    ]

    if (profile.strength.intentStrength < 0.3) {
      directive.push('注意：输入极简，允许大幅扩展和创意填充')
    } else if (profile.strength.intentStrength > 0.7) {
      directive.push('注意：输入完整，严格保留原始结构，禁止过度扩展')
    }

    return directive.join('\n')
  }
}

export const intentRouter = new IntentRouter()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow-jobs",
  "mode": "SHADOW"
};

