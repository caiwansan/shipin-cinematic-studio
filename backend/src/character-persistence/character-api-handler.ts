/**
 * Character Persistence Engine API Handler
 */

import { CharacterPersistenceEngine } from './character-persistence-engine'
import { createDefaultCharacter, CharacterIdentity } from './character-identity-graph'
import { traceCollector } from '../replay-engine/director-trace-collector.js'

export interface PersistenceAnalyzeRequest {
  /** 自然语言描述的镜头列表 */
  shotTexts: string[]
  /** 角色信息（可选，不传则使用缺省角色） */
  character?: {
    name: string
    ethnicity?: string
    age?: string
    features?: string[]
    height?: string
    build?: string
    outfit?: string
    colors?: string[]
    style?: string
  }
}

const persistenceEngine = new CharacterPersistenceEngine()

/**
 * 分析一组镜头的角色一致性
 */
export function handlePersistenceAnalyze(req: PersistenceAnalyzeRequest) {
  try {
    const tid = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    traceCollector.emit('character', 'PERSISTENCE_INIT', { shotCount: req.shotTexts.length, characterName: req.character?.name }, tid)

    const identity = buildIdentity(req.character || { name: '默认角色' })
    traceCollector.emit('character', 'CHARACTER_IDENTITY_LOADED', { name: identity.name, id: identity.id }, tid)

    const result = persistenceEngine.run(req.shotTexts, identity)

    return {
      success: true,
      result: {
        overallStability: result.overallStability,
        driftReports: result.driftReports.map((r, i) => {
          traceCollector.emit('character', 'DRIFT_CHECKED', { pair: `shot_${i + 1}→shot_${i + 2}`, overall: r.overall, isStable: r.isStable }, tid)
          return {
            pair: `shot_${i + 1}→shot_${i + 2}`,
            overall: +(r.overall * 100).toFixed(0),
            isStable: r.isStable,
            details: r.details,
          }
        }),
        stabilizations: result.stabilizations
          .filter(s => s.didStabilize)
          .map(s => {
            traceCollector.emit('character', 'STABILIZATION_APPLIED', { level: s.stabilityLevel, actions: s.actions }, tid)
            return {
              actions: s.actions,
              level: s.stabilityLevel,
            }
          }),
        summary: result.summary,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * 从请求参数构建角色身份
 */
function buildIdentity(cfg: { name: string; ethnicity?: string; age?: string; features?: string[]; height?: string; build?: string; outfit?: string; colors?: string[]; style?: string }): CharacterIdentity {
  return {
    id: `char_${cfg.name}_${Date.now()}`,
    name: cfg.name,
    facialSignature: {
      ethnicity: cfg.ethnicity || 'East Asian',
      age: cfg.age || 'young adult',
      features: cfg.features || ['defined features'],
      portraitStyle: 'natural expression',
      embeddingPlaceholder: `placeholder-${cfg.name}-${Date.now()}`,
    },
    bodySignature: {
      height: (cfg.height as any) || 'average',
      build: (cfg.build as any) || 'average',
      postureBias: 'upright',
      signatureMannerism: `stands as ${cfg.name} does`,
    },
    outfitSchema: {
      baseClothing: cfg.outfit || 'casual modern outfit',
      colorPalette: cfg.colors || ['navy', 'white'],
      accessories: [],
      style: (cfg.style as any) || 'casual',
    },
  }
}
