/**
 * observability/ctblScheduler.ts
 *
 * Periodic CTBL Decision Engine trigger
 * Runs every 10 minutes (or can be manually triggered via health endpoint)
 */

import { pushObservation, parseCTBLLogLine } from './ctblMetricsAggregator.js'
import { decide, formatDecision } from './ctblDecisionEngine.js'
import { trendTracker } from './dashboard/ctblTrendTracker.js'
import { readFileSync } from 'fs'

const LOG_FILE = '/root/.pm2/logs/api-server-aigc-out.log'
const CHECK_INTERVAL_MS = 10 * 60 * 1000  // 10 minutes
const MIN_SAMPLES_BETWEEN_CHECKS = 5      // Or every 5 new observations

let lastProcessedLineCount = 0
let intervalHandle: ReturnType<typeof setInterval> | null = null

/**
 * Scan recent logs for new [CTBL-OBS] entries and feed them into the aggregator
 */
function harvestObservations(): number {
  try {
    const content = readFileSync(LOG_FILE, 'utf-8')
    const lines = content.split('\n')
    const newLines = lines.slice(lastProcessedLineCount)
    
    for (const line of newLines) {
      const obs = parseCTBLLogLine(line)
      if (obs) {
        pushObservation(obs)
      }
    }
    
    const newCount = newLines.length
    lastProcessedLineCount = lines.length
    return newCount
  } catch {
    return 0
  }
}

/**
 * Run one decision cycle: harvest → compute → decide → log
 */
export function runDecisionCycle(): void {
  const newLines = harvestObservations()
  const result = decide()
  const output = formatDecision(result)
  console.log(output)
  
  // Record convergence trend point
  trendTracker.record()
}

/**
 * Start periodic decision engine
 */
export function startDecisionScheduler(): void {
  if (intervalHandle) return
  
  // Initial harvest
  harvestObservations()
  
  intervalHandle = setInterval(() => {
    runDecisionCycle()
  }, CHECK_INTERVAL_MS)
  
  console.log('[CTBL-Scheduler] ✅ Decision engine started (interval: 10min)')
}

/**
 * Stop periodic scheduler
 */
export function stopDecisionScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
    console.log('[CTBL-Scheduler] ⏹  Decision engine stopped')
  }
}

/**
 * Get current decision status (for health endpoints)
 */
export function getCurrentStatus(): object {
  harvestObservations()
  const result = decide()
  return {
    decision: result.decision,
    timestamp: result.timestamp,
    gsr: result.metrics.gsr,
    csr: result.metrics.csr,
    failureRate: result.metrics.failureRate,
    failureTypes: result.metrics.failureBreakdown,
    sampleCount: result.metrics.sampleCount,
    confidenceInterval: result.confidenceInterval,
    canEnableCSIP: result.decision === 'ENABLE_CSIP',
  }
}
