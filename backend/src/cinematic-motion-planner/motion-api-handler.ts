/**
 * Cinematic Motion System API Handler
 */

import { ShotGrammarType } from '../cinematic-grammar/shot-grammar-tree'
import { CinematicMotionSystem } from './cinematic-motion-system'
import { traceCollector } from '../replay-engine/director-trace-collector.js'

export interface MotionPlanRequest {
  /** 镜头语法类型列表 */
  grammarTypes: string[]
  /** 各镜头强度 */
  intensities: number[]
  /** 各镜头情绪张力 */
  tensions: number[]
  /** 镜头描述（可选） */
  shotTexts?: string[]
}

const motionSystem = new CinematicMotionSystem()

export function handleGenerateMotionPlan(req: MotionPlanRequest) {
  try {
    const tid = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    traceCollector.emit('motion', 'MOTION_INIT', { shotCount: req.grammarTypes.length }, tid)
    const plan = motionSystem.generateMotionPlan({
      grammarTypes: req.grammarTypes as ShotGrammarType[],
      intensities: req.intensities,
      tensions: req.tensions,
      shotTexts: req.shotTexts,
    })

    return {
      success: true,
      result: {
        events: plan.events.map(e => {
          traceCollector.emit('motion', 'MOTION_INTENT_COMPUTED', {
            shotIndex: e.shotIndex,
            motionStyle: e.motionStyle,
            intent: e.motionIntent,
            narrativeEffect: e.narrativeEffect,
          }, tid)
          return {
            index: e.shotIndex + 1,
            type: e.grammarType,
            motionStyle: e.motionStyle,
            motionDirective: e.motionDirective,
            narrativeEffect: e.narrativeEffect,
            intent: {
            pressure: +(e.motionIntent.pressure * 100).toFixed(0),
            intimacy: +(e.motionIntent.intimacy * 100).toFixed(0),
            instability: +(e.motionIntent.instability * 100).toFixed(0),
            energyFlow: +e.motionIntent.energyFlow.toFixed(2),
            recMovement: e.motionIntent.recommendedMovement,
          },
        }}),
        feasibility: {
          valid: plan.feasibility.valid,
          violations: plan.feasibility.violations,
          summary: plan.feasibility.summary,
        },
        timeline: plan.timelineSummary,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
