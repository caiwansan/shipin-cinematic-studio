/**
 * Narrative Elasticity Engine v3 — 叙事弹性控制
 *
 * 基于意图强度和类型，决定系统需要"扩展多少"。
 * 核心规则：短输入自由创作，长输入严格保留结构。
 */

import { IntentType } from './intent-classifier.js'
import { IntentStrength } from './intent-strength-analyzer.js'

export type ExpansionMode = 'expand' | 'preserve' | 'refine'
export type PipelineStrategy = 'full_generate' | 'assist_generate' | 'strict_execute'

export interface ElasticityPolicy {
  mode: ExpansionMode
  pipelineStrategy: PipelineStrategy
  expansionLevel: number  // 1-10, 10=最大扩展
  constraints: {
    allowNarrativeSynthesis: boolean
    allowEmotionExpansion: boolean
    allowStructureGeneration: boolean
    preserveOriginalElements: boolean
    maxEpisodes: number
  }
}

export class NarrativeElasticityEngine {
  computePolicy(intentType: IntentType, strength: IntentStrength): ElasticityPolicy {
    // 根据意图强度和类型决定扩展策略
    if (strength.intentStrength > 0.7) {
      // 高完整度：严格保留，最小干预
      return {
        mode: 'preserve',
        pipelineStrategy: 'strict_execute',
        expansionLevel: 2,
        constraints: {
          allowNarrativeSynthesis: false,
          allowEmotionExpansion: false,
          allowStructureGeneration: false,
          preserveOriginalElements: true,
          maxEpisodes: strength.completeness > 0.9 ? 60 : 12,
        },
      }
    }

    if (strength.intentStrength > 0.4) {
      // 中等：适当补充
      return {
        mode: 'refine',
        pipelineStrategy: 'assist_generate',
        expansionLevel: 5,
        constraints: {
          allowNarrativeSynthesis: true,
          allowEmotionExpansion: true,
          allowStructureGeneration: intentType !== 'scene_request',
          preserveOriginalElements: true,
          maxEpisodes: 24,
        },
      }
    }

    // 低强度：大幅扩展
    return {
      mode: 'expand',
      pipelineStrategy: 'full_generate',
      expansionLevel: 9,
      constraints: {
        allowNarrativeSynthesis: true,
        allowEmotionExpansion: true,
        allowStructureGeneration: true,
        preserveOriginalElements: false,
        maxEpisodes: 12,
      },
    }
  }
}

export const narrativeElasticityEngine = new NarrativeElasticityEngine()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow-jobs",
  "mode": "SHADOW"
};

