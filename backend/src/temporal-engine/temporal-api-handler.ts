/**
 * Temporal Consistency Engine API Handler
 */

import { TemporalConsistencyEngine } from './temporal-consistency-engine'
import { CinematicShot } from '../cinematic-compiler/cinematic-dsl-schema'
import { traceCollector } from '../replay-engine/director-trace-collector.js'

const temporalEngine = new TemporalConsistencyEngine()

export interface TemporalAnalyzeRequest {
  /** 自然语言描述的镜头列表 */
  shotTexts: string[]
}

/**
 * 分析一组镜头的连续性
 */
export function handleTemporalAnalyze(req: TemporalAnalyzeRequest) {
  try {
    const tid = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    traceCollector.emit('temporal', 'TEMPORAL_INIT', { shotCount: req.shotTexts.length }, tid)

    // 将自然语言描述转为 CinematicShot（简化处理）
    const shots: CinematicShot[] = req.shotTexts.map((t, i) => {
      const compiled: CinematicShot = { raw: t, camera: {} as any, composition: {} as any, lighting: {} as any, motion: {} as any, mood: '' }
      traceCollector.emit('temporal', 'SHOT_COMPILED', { index: i, text: t.slice(0, 50) }, tid)
      return compiled
    })

    // 运行时间连续性分析
    const result = temporalEngine.run(shots)
    traceCollector.emit('temporal', 'CONTINUITY_RESOLVED', { averageContinuity: result.averageContinuity, weakLinkCount: result.weakLinks.length }, tid)

    return {
      success: true,
      traceId: tid,
      result: {
        averageContinuity: result.averageContinuity,
        weakLinks: result.weakLinks.map(l => ({
          sceneId: l.state.sceneId,
          continuityScore: l.continuityScore,
        })),
        injected: result.injected.map(i => ({
          continuityScore: i.continuityScore,
          hadTransitionHint: i.hadTransitionHint,
          promptLength: i.injectedPrompt.length,
        })),
        summary: result.summary,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
