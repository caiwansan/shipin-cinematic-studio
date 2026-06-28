/**
 * observability/dashboard/ctblConvergenceDashboard.ts
 *
 * CTBL Statistical Convergence Monitor Dashboard
 *
 * Observe-only: reads metrics from existing CTBL-OBS logs + Decision Engine.
 * No production impact. No pipeline changes. No state mutation.
 *
 * Purpose:
 *   Determine when OGES v1 has reached statistical convergence for CSIP readiness.
 */

import { readFileSync } from 'fs'
import { parseCTBLLogLine, pushObservation, computeMetrics } from '../ctblMetricsAggregator.js'
import { decide } from '../ctblDecisionEngine.js'

const LOG_FILE = '/root/.pm2/logs/api-server-aigc-out.log'
const WINDOW_SIZE = 50

export type ConvergenceState = 'COLD_START' | 'WARMING_UP' | 'CONVERGING' | 'UNSTABLE'

export interface ConvergenceSnapshot {
  timestamp: number
  sampleSize: number
  metrics: {
    gsr: number
    csr: number
    failureRate: number
    ciWidth: number
    ctblPresenceRate: number
    avgPromptLen: number
    failureBreakdown: Record<string, number>
  }
  readiness: {
    csipEligible: boolean
    convergenceState: ConvergenceState
    recommendedDecision: 'HOLD' | 'ENABLE_CSIP' | 'ALERT' | 'INSUFFICIENT_DATA'
  }
  shadowStats: {
    totalObservations: number
  }
}

export class CTBLConvergenceDashboard {
  /**
   * Harvest recent CTBL-OBS logs and feed into the metrics engine
   */
  harvest(): number {
    try {
      const content = readFileSync(LOG_FILE, 'utf-8')
      const lines = content.split('\n')
      let count = 0
      for (const line of lines) {
        const obs = parseCTBLLogLine(line)
        if (obs) {
          pushObservation(obs)
          count++
        }
      }
      return count
    } catch {
      return 0
    }
  }

  /**
   * Get convergence snapshot from current metrics
   */
  getSnapshot(): ConvergenceSnapshot {
    this.harvest()
    const metrics = computeMetrics()
    const decision = decide()
    const sampleSize = metrics.sampleCount

    // GSR
    const gsr = metrics.gsr
    const csr = metrics.csr
    const failureRate = metrics.failureRate
    const ciWidth = decision.confidenceInterval.high - decision.confidenceInterval.low

    const csipEligible =
      sampleSize >= 30 &&
      gsr > 0.95 &&
      csr > 0.90 &&
      failureRate < 0.03 &&
      ciWidth < 0.15

    const convergenceState = this.getConvergenceState(sampleSize, gsr, csr, ciWidth)

    // Shadow stats from UOA Shadow logs
    const shadowCount = (content: string) =>
      content.split('\n').filter((l: string) => l.includes('UOA-SHADOW')).length

    let shadowTotal = 0
    try {
      const logContent = readFileSync(LOG_FILE, 'utf-8')
      shadowTotal = shadowCount(logContent)
    } catch {}

    return {
      timestamp: Date.now(),
      sampleSize,
      metrics: {
        gsr,
        csr,
        failureRate,
        ciWidth,
        ctblPresenceRate: metrics.ctblPresenceRate,
        avgPromptLen: Math.round(metrics.avgPromptLen),
        failureBreakdown: metrics.failureBreakdown,
      },
      readiness: {
        csipEligible,
        convergenceState,
        recommendedDecision: decision.decision,
      },
      shadowStats: {
        totalObservations: shadowTotal,
      },
    }
  }

  private getConvergenceState(N: number, gsr: number, csr: number, ci: number): ConvergenceState {
    if (N < 10) return 'COLD_START'
    if (N < 30) return 'WARMING_UP'
    if (gsr > 0.95 && csr > 0.90 && ci < 0.15) return 'CONVERGING'
    return 'UNSTABLE'
  }
}

// Singleton
export const convergenceDashboard = new CTBLConvergenceDashboard()
