// SLA Controller v1
// Service Level Agreement: defines expected performance tiers and monitors compliance

export type SLATier = 'fast' | 'balanced' | 'production'

export interface SLAConfig {
  tier: SLATier
  maxLatencyMs: number
  minQualityScore: number
  maxCostPerMinute: number     // USD per minute of output
  maxRetries: number
  description: string
}

export const SLA_DEFAULTS: Record<SLATier, SLAConfig> = {
  fast: {
    tier: 'fast',
    maxLatencyMs: 10_000,       // < 10 seconds
    minQualityScore: 0,         // any quality
    maxCostPerMinute: 0.01,     // cheap: < $0.01/min
    maxRetries: 1,
    description: 'Quick preview / draft quality',
  },
  balanced: {
    tier: 'balanced',
    maxLatencyMs: 60_000,       // < 1 minute
    minQualityScore: 4,
    maxCostPerMinute: 0.20,     // $0.20/min — accommodates volcengine seedance
    maxRetries: 2,
    description: 'Standard production quality',
  },
  production: {
    tier: 'production',
    maxLatencyMs: 300_000,      // < 5 minutes
    minQualityScore: 7,
    maxCostPerMinute: 0.50,
    maxRetries: 3,
    description: 'High quality / client-ready',
  },
}

export interface SLAViolation {
  tier: SLATier
  metric: 'latency' | 'cost' | 'quality'
  expected: string
  actual: string
  jobId: string
  provider: string
  timestamp: string
}

export class SLAController {
  private violations: SLAViolation[] = []
  private maxViolations = 500
  private currentOverrides: Partial<Record<SLATier, Partial<SLAConfig>>> = {}

  // ── Get effective config for a tier ──

  getConfig(tier: SLATier): SLAConfig {
    const base = SLA_DEFAULTS[tier]
    const override = this.currentOverrides[tier]
    return override ? { ...base, ...override } : base
  }

  // ── Check if an execution met its SLA ──

  check(tier: SLATier, jobId: string, provider: string, latencyMs: number, cost: number, duration: number, qualityScore?: number): SLAViolation[] {
    const config = this.getConfig(tier)
    const violations: SLAViolation[] = []
    const ts = new Date().toISOString()

    // Check latency
    if (latencyMs > config.maxLatencyMs) {
      violations.push({
        tier, metric: 'latency',
        expected: `< ${config.maxLatencyMs}ms`,
        actual: `${latencyMs}ms`,
        jobId, provider, timestamp: ts,
      })
    }

    // Check cost
    const costPerMinute = duration > 0 ? (cost / duration) * 60 : 0
    if (costPerMinute > config.maxCostPerMinute) {
      violations.push({
        tier, metric: 'cost',
        expected: `< $${config.maxCostPerMinute}/min`,
        actual: `$${costPerMinute.toFixed(4)}/min`,
        jobId, provider, timestamp: ts,
      })
    }

    // Check quality
    if (qualityScore !== undefined && qualityScore < config.minQualityScore) {
      violations.push({
        tier, metric: 'quality',
        expected: `>= ${config.minQualityScore}/10`,
        actual: `${qualityScore}/10`,
        jobId, provider, timestamp: ts,
      })
    }

    // Record violations
    this.violations.push(...violations)
    if (this.violations.length > this.maxViolations) {
      this.violations.splice(0, this.violations.length - this.maxViolations)
    }

    return violations
  }

  // ── Get SLA violations ──

  getViolations(tier?: SLATier, limit = 50): SLAViolation[] {
    let result = this.violations
    if (tier) result = result.filter(v => v.tier === tier)
    return result.slice(-limit)
  }

  // ── Override SLA config for a tier ──

  override(tier: SLATier, config: Partial<SLAConfig>): void {
    this.currentOverrides[tier] = { ...this.currentOverrides[tier], ...config }
  }

  // ── Reset overrides ──

  reset(tier?: SLATier): void {
    if (tier) {
      delete this.currentOverrides[tier]
    } else {
      this.currentOverrides = {}
    }
  }

  // ── Status ──

  getStatus() {
    return {
      tiers: Object.values(SLA_DEFAULTS).map(cfg => ({
        ...cfg,
        effective: this.getConfig(cfg.tier),
      })),
      violations: {
        total: this.violations.length,
        latest: this.violations.slice(-10).map(v => ({
          tier: v.tier,
          metric: v.metric,
          provider: v.provider,
          expected: v.expected,
          actual: v.actual,
        })),
      },
    }
  }
}

export const slaController = new SLAController()
