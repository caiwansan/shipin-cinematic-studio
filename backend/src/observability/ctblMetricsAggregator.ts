/**
 * observability/ctblMetricsAggregator.ts
 *
 * CTBL Real-time Metrics Aggregator
 * Rolling-window metrics from CTBL-OBS structured logs
 *
 * Used by: ctblDecisionEngine.ts
 * Source: CTBL-OBS log lines from worker-runtime.ts
 */

export interface CTBLObservation {
  timestamp: number
  ctblPresent: boolean
  csrEmotion: boolean
  csrScene: boolean
  csrAction: boolean
  csrLighting: boolean
  csrAtmosphere: boolean
  gsr: number            // 1 = success, 0 = failure
  promptLen: number
  failure: string        // 'none' | 'model_rejection' | 'prompt_truncation' | 'generation_timeout' | etc.
}

export interface CTBLMetrics {
  gsr: number            // Generation Success Rate
  csr: number            // Constraint Satisfaction Rate
  failureRate: number    // Overall failure rate
  failureBreakdown: Record<string, number>  // failure type → count
  sampleCount: number
  avgPromptLen: number
  ctblPresenceRate: number
}

const WINDOW_SIZE = 50
const observations: CTBLObservation[] = []

/**
 * Parse a [CTBL-OBS] log line into a structured observation
 */
export function parseCTBLLogLine(line: string): CTBLObservation | null {
  if (!line.includes('[CTBL-OBS]')) return null
  try {
    const obs: CTBLObservation = {
      timestamp: Date.now(),
      ctblPresent: line.includes('CTBL_PRESENT:true'),
      csrEmotion: line.includes('CSR_EMOTION:true'),
      csrScene: line.includes('CSR_SCENE:true'),
      csrAction: line.includes('CSR_ACTION:true'),
      csrLighting: line.includes('CSR_LIGHTING:true'),
      csrAtmosphere: line.includes('CSR_ATMOSPHERE:true'),
      gsr: line.includes('GSR:1') ? 1 : 0,
      promptLen: parseInt(line.match(/PROMPT_LEN:(\d+)/)?.[1] || '0', 10),
      failure: line.match(/FAILURE:(\w+)/)?.[1] || 'unknown',
    }
    return obs
  } catch {
    return null
  }
}

/**
 * Add an observation to the rolling window
 */
export function pushObservation(obs: CTBLObservation): void {
  observations.push(obs)
  // Keep only the last WINDOW_SIZE observations
  while (observations.length > WINDOW_SIZE) {
    observations.shift()
  }
}

/**
 * Compute rolling-window metrics from current observations
 */
export function computeMetrics(): CTBLMetrics {
  const total = observations.length
  if (total === 0) {
    return {
      gsr: 0,
      csr: 0,
      failureRate: 0,
      failureBreakdown: {},
      sampleCount: 0,
      avgPromptLen: 0,
      ctblPresenceRate: 0,
    }
  }

  const successes = observations.filter(o => o.gsr === 1)
  const ctblPresent = observations.filter(o => o.ctblPresent)
  const csrPass = ctblPresent.filter(o => o.csrEmotion && o.csrScene && o.csrAction)
  const failures = observations.filter(o => o.failure !== 'none')

  const failureBreakdown: Record<string, number> = {}
  for (const f of failures) {
    failureBreakdown[f.failure] = (failureBreakdown[f.failure] || 0) + 1
  }

  return {
    gsr: successes.length / total,
    csr: ctblPresent.length > 0 ? csrPass.length / ctblPresent.length : 0,
    failureRate: failures.length / total,
    failureBreakdown,
    sampleCount: total,
    avgPromptLen: observations.reduce((s, o) => s + o.promptLen, 0) / total,
    ctblPresenceRate: ctblPresent.length / total,
  }
}

/**
 * Check if we have enough samples for a statistically meaningful decision
 */
export function hasEnoughSamples(minSamples: number = 30): boolean {
  return observations.length >= minSamples
}
