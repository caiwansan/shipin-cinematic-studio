// Cost Learner v1
// Learns from actual execution history to dynamically optimize provider selection
// Replaces hardcoded profiles with real-world data over time

import { COST_PROFILES, type CostProfile } from './cost-profiles.js'

// ── Execution Record ──

export interface ExecutionRecord {
  provider: string
  model: string
  duration: number               // video duration in seconds
  latencyMs: number              // actual end-to-end latency
  cost: number                   // actual cost in USD
  qualityScore: number           // user-rated quality (0 = unknown)
  timestamp: string
  success: boolean
  error?: string
}

// ── Cost Learner ──

export class CostLearner {
  private history: ExecutionRecord[] = []
  private maxHistory = 1000

  // ── Record execution ──

  record(exec: ExecutionRecord): void {
    this.history.push(exec)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }

  // ── Get average metrics per provider ──

  getLearnedProfile(provider: string, model: string): Partial<CostProfile> {
    const records = this.history.filter(
      r => r.provider === provider && r.model === model && r.success
    )

    if (records.length < 3) {
      return {}  // not enough data yet
    }

    const avgLatency = Math.round(
      records.reduce((s, r) => s + r.latencyMs, 0) / records.length
    )
    const avgCostPerSecond = +(records.reduce((s, r) => s + r.cost, 0) / records.reduce((s, r) => s + r.duration, 0.001)).toFixed(6)
    const avgQuality = records.length > 0
      ? records.filter(r => r.qualityScore > 0).reduce((s, r) => s + r.qualityScore, 0) / records.filter(r => r.qualityScore > 0).length || 0
      : 0

    return {
      avgLatencyMs: avgLatency,
      costPerSecond: avgCostPerSecond,
      qualityScore: avgQuality > 0 ? Math.round(avgQuality * 10) / 10 : undefined,
    }
  }

  // ── Get merged profile (base + learned) ──

  getEffectiveProfile(provider: string, model: string): CostProfile {
    const base = model
      ? COST_PROFILES.find(p => p.provider === provider && p.model === model)
      : COST_PROFILES.find(p => p.provider === provider)
    if (!base) throw new Error(`No base profile for ${provider}/${model || '(any)'}`)

    const learned = this.getLearnedProfile(provider, base.model)

    return {
      ...base,
      ...learned,  // learned overrides base
    }
  }

  // ── Stats ──

  getStats() {
    const total = this.history.length
    const success = this.history.filter(r => r.success).length
    const failures = total - success
    const totalCost = this.history.reduce((s, r) => s + r.cost, 0)

    const byProvider: Record<string, { count: number; success: number; avgLatency: number }> = {}
    for (const r of this.history) {
      const key = `${r.provider}/${r.model}`
      if (!byProvider[key]) byProvider[key] = { count: 0, success: 0, avgLatency: 0 }
      byProvider[key].count++
      if (r.success) byProvider[key].success++
      byProvider[key].avgLatency = r.latencyMs
    }

    return {
      totalRecords: total,
      successRate: total > 0 ? Math.round((success / total) * 100) + '%' : '0%',
      totalCost: '$' + totalCost.toFixed(4),
      byProvider: Object.entries(byProvider).map(([k, v]) => ({
        provider: k,
        executions: v.count,
        successRate: Math.round((v.success / v.count) * 100) + '%',
        avgLatencyMs: v.count > 0 ? Math.round(v.avgLatency / v.count) : 0,
      })),
    }
  }
}

export const costLearner = new CostLearner()
