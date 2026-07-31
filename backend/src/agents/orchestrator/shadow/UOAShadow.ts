/**
 * @deprecated
 * Reality Recovery Phase5
 * Production path unused — 仅被 UOA.ts 内部 import，UOA 本身无业务调用，随 UOA 失活。
 *
 * agents/orchestrator/shadow/UOAShadow.ts
 *
 * UOA Shadow Learning Layer
 *
 * Non-intrusive observer that simulates alternative orchestration strategies
 * without affecting production execution.
 *
 * Purpose:
 * - Collect counterfactual learning signals for future UOA v2
 * - No production impact (no blocking, no state mutation)
 * - Only logs structured observation data
 */

import type { VideoJobContext, VideoJobResult } from '../UOA.js'

export interface ShadowObservation {
  jobId: string
  timestamp: number
  scriptComplexity: number
  shotCount: number
  estimatedStructureEfficiency: number
  estimatedGainVsBaseline: number
  divergenceFromRuntime: number
}

export class UOAShadow {
  private observationCount = 0

  /**
   * Execute shadow simulation for a completed job
   * Non-blocking: errors are caught and logged, never propagated
   */
  async simulate(job: VideoJobContext, _runtimeOutput: VideoJobResult): Promise<void> {
    // Shadow NEVER blocks or affects the main execution path
    try {
      this.observationCount++

      const shotCount = job.segments?.length || 0
      const scriptLen = (job.script || '').length || 0

      // Compute structural efficiency based on shot density and narrative length
      const complexityScore = shotCount > 0 ? scriptLen / shotCount : 0
      const structureEfficiency = Math.min(1.0, shotCount > 0 ? (shotCount * 80) / Math.max(scriptLen, 1) : 0.8)

      // Estimate v2 gain potential — higher when complexity is high but structure is weak
      const estimatedGain = structureEfficiency < 0.6 ? Math.min(0.5, (0.6 - structureEfficiency) * 1.5) : 0.0

      const obs: ShadowObservation = {
        jobId: job.id,
        timestamp: Date.now(),
        scriptComplexity: Math.round(complexityScore),
        shotCount,
        estimatedStructureEfficiency: Math.round(structureEfficiency * 100) / 100,
        estimatedGainVsBaseline: Math.round(estimatedGain * 100) / 100,
        divergenceFromRuntime: 0,  // future: compare vs actual execution path
      }

      // Structured log only — no state mutation
      console.log('[UOA-SHADOW]', JSON.stringify(obs))
    } catch {
      // Silent: shadow must never affect production
    }
  }

  /** Shadow statistics (for diagnostics only) */
  getStats(): { totalObservations: number } {
    return { totalObservations: this.observationCount }
  }
}

// Singleton shadow instance
export const shadow = new UOAShadow()
