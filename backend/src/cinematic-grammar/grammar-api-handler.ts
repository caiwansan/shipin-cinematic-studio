/**
 * Cinematic Grammar System API Handler
 */

import { CinematicGrammarSystem } from './cinematic-grammar-system'
import { traceCollector } from '../replay-engine/director-trace-collector.js'

export interface GrammarAnalyzeRequest {
  /** 自然语言描述的镜头列表 */
  shotTexts: string[]
  /** 预设语法模板（可选） */
  preset?: string
}

const grammarSystem = new CinematicGrammarSystem()

/**
 * 分析一组镜头的语法结构
 */
export function handleGrammarAnalyze(req: GrammarAnalyzeRequest) {
  try {
    const tid = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    traceCollector.emit('grammar', 'GRAMMAR_INIT', { shotCount: req.shotTexts.length, preset: req.preset }, tid)
    const result = grammarSystem.run(req.shotTexts, req.preset)

    return {
      success: true,
      traceId: tid,
      result: {
        annotatedShots: result.annotatedShots.map(s => {
          traceCollector.emit('grammar', 'SHOT_GRAMMAR_RESOLVED', { text: s.text.slice(0, 50), grammarType: s.grammarType, sortedPosition: s.sortedPosition }, tid)
          return {
            text: s.text.slice(0, 50),
            grammarType: s.grammarType,
            sortedPosition: s.sortedPosition,
          }
        }),
        emotionalArc: {
          arcType: result.emotionalArc.arcType,
          maxTension: +(result.emotionalArc.maxTension * 100).toFixed(0),
          volatility: +(result.emotionalArc.volatility * 100).toFixed(0),
          tensionCurve: result.emotionalArc.points.map(p => {
            traceCollector.emit('grammar', 'EMOTION_COMPUTED', { shot: p.index + 1, tension: p.emotionalTension, mood: p.mood }, tid)
            return {
              shot: p.index + 1,
              tension: +(p.emotionalTension * 100).toFixed(0),
              mood: p.mood,
            }
          }),
        },
        constraintReport: {
          passed: result.constraintReport.passed,
          violations: result.constraintReport.hardViolations.length,
          recommendations: result.constraintReport.recommendations,
          details: result.constraintReport.constraints.map(c => ({
            name: c.name,
            severity: c.severity,
            violation: c.violation,
          })),
        },
        summary: result.summary,
        cflResult: result.cflResult ? {
          coherence: result.cflResult.coherence,
          stateTrace: result.cflResult.stateTrace.map(s => ({
            emotion: {
              tension: +s.emotionState.tension.toFixed(3),
              curiosity: +s.emotionState.curiosity.toFixed(3),
              calmness: +s.emotionState.calmness.toFixed(3),
              urgency: +s.emotionState.urgency.toFixed(3),
            },
            visual: {
              framingBias: s.visualState.framingBias,
              motionMomentum: s.visualState.motionMomentum,
            },
            rhythm: {
              pace: +s.rhythmState.pace.toFixed(3),
              cutPressure: +s.rhythmState.cutPressure.toFixed(3),
            },
          })),
          lockResults: result.cflResult.lockResults,
        } : undefined,
      },
    }
  } catch (err: any) {
    return { success: false, traceId: 'unknown', error: err.message }
  }
}
