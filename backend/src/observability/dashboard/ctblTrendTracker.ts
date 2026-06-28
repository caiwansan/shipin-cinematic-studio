/**
 * observability/dashboard/ctblTrendTracker.ts
 *
 * CTBL Convergence Trend Tracker
 *
 * Records snapshots over time to visualize convergence trajectory.
 * Observe-only: no production impact, no state mutation.
 *
 * Purpose:
 *   Show how metrics evolve from cold start → stable distribution.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { convergenceDashboard } from './ctblConvergenceDashboard.js'

const TREND_FILE = '/root/shipin-cinematic-studio/data/observability/ctbl-trend.json'

export interface TrendPoint {
  timestamp: number
  sampleSize: number
  gsr: number
  csr: number
  failureRate: number
  ciWidth: number | null
  convergenceState: string
  csipEligible: boolean
}

export class CTBLTrendTracker {
  /**
   * Record a snapshot point
   */
  record(): TrendPoint {
    const snapshot = convergenceDashboard.getSnapshot()
    const point: TrendPoint = {
      timestamp: snapshot.timestamp,
      sampleSize: snapshot.sampleSize,
      gsr: Math.round(snapshot.metrics.gsr * 1000) / 1000,
      csr: Math.round(snapshot.metrics.csr * 1000) / 1000,
      failureRate: Math.round(snapshot.metrics.failureRate * 1000) / 1000,
      ciWidth: snapshot.metrics.ciWidth !== null ? Math.round(snapshot.metrics.ciWidth * 1000) / 1000 : null,
      convergenceState: snapshot.readiness.convergenceState,
      csipEligible: snapshot.readiness.csipEligible,
    }

    this.append(point)
    return point
  }

  /**
   * Get all recorded trend points
   */
  getHistory(): TrendPoint[] {
    try {
      const content = readFileSync(TREND_FILE, 'utf-8')
      return JSON.parse(content)
    } catch {
      return []
    }
  }

  /**
   * Get convergence summary
   */
  getSummary(): object {
    const history = this.getHistory()
    if (history.length === 0) {
      return { totalPoints: 0, sampleSizeRange: [0, 0], message: 'No data yet' }
    }

    const first = history[0]
    const last = history[history.length - 1]
    const duration = last.timestamp - first.timestamp

    return {
      totalPoints: history.length,
      sampleSizeRange: [first.sampleSize, last.sampleSize],
      observationDurationMs: duration,
      observationDurationHours: Math.round(duration / 3600000 * 10) / 10,
      currentGsr: last.gsr,
      currentCsr: last.csr,
      currentCiWidth: last.ciWidth,
      convergenceState: last.convergenceState,
      csipEligible: last.csipEligible,
    }
  }

  private append(point: TrendPoint): void {
    try {
      const dir = '/root/shipin-cinematic-studio/data/observability'
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      let history: TrendPoint[] = []
      try {
        const content = readFileSync(TREND_FILE, 'utf-8')
        history = JSON.parse(content)
      } catch {
        history = []
      }

      history.push(point)

      // Keep max 1000 points
      while (history.length > 1000) {
        history.shift()
      }

      writeFileSync(TREND_FILE, JSON.stringify(history, null, 2))
    } catch {
      // Silent: tracker must never affect production
    }
  }
}

export const trendTracker = new CTBLTrendTracker()
