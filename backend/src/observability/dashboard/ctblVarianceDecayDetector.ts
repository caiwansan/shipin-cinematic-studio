/**
 * observability/dashboard/ctblVarianceDecayDetector.ts
 *
 * Variance Decay Detector
 *
 * Tracks how metric variance evolves with sample size.
 * Early predictor of convergence even before N=30.
 *
 * Observe-only: no production impact.
 */

export interface VarianceDecayPoint {
  timestamp: number
  sampleSize: number
  gsrWindowVariance: number
  csrWindowVariance: number
  isDecaying: boolean  // variance decreasing over last 3 points
  convergencePrediction: 'CONVERGING' | 'STABLE_NOISY' | 'DIVERGING' | 'INSUFFICIENT'
}

export class CTBLVarianceDecayDetector {
  private previousGsv: number[] = []
  private previousCsv: number[] = []
  private previousSampleSizes: number[] = []

  /**
   * Evaluate variance decay from current snapshot
   */
  evaluate(sampleSize: number, gsr: number, csr: number): VarianceDecayPoint {
    // Track last 5 observations
    this.previousGsv.push(gsr)
    this.previousCsv.push(csr)
    this.previousSampleSizes.push(sampleSize)

    while (this.previousGsv.length > 5) this.previousGsv.shift()
    while (this.previousCsv.length > 5) this.previousCsv.shift()
    while (this.previousSampleSizes.length > 5) this.previousSampleSizes.shift()

    const gsrVariance = this.computeVariance(this.previousGsv)
    const csrVariance = this.computeVariance(this.previousCsv)

    // Detect decay: variance decreasing over last 3 points
    const gsrDecaying = this.isTrendingDown(this.previousGsv.slice(-3))
    const csrDecaying = this.isTrendingDown(this.previousCsv.slice(-3))
    const isDecaying = (gsrDecaying || csrDecaying) && this.previousGsv.length >= 3

    // Predict convergence
    const prediction = this.predict(sampleSize, gsrVariance, csrVariance, isDecaying)

    return {
      timestamp: Date.now(),
      sampleSize,
      gsrWindowVariance: Math.round(gsrVariance * 10000) / 10000,
      csrWindowVariance: Math.round(csrVariance * 10000) / 10000,
      isDecaying,
      convergencePrediction: prediction,
    }
  }

  private computeVariance(values: number[]): number {
    if (values.length < 2) return 1
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  }

  private isTrendingDown(values: number[]): boolean {
    if (values.length < 3) return false
    // Check if successive deltas are negative (decreasing trend)
    let downCount = 0
    for (let i = 1; i < values.length; i++) {
      if (values[i] <= values[i - 1]) downCount++
    }
    return downCount >= values.length - 1
  }

  private predict(
    N: number,
    gsrV: number,
    csrV: number,
    decaying: boolean,
  ): 'CONVERGING' | 'STABLE_NOISY' | 'DIVERGING' | 'INSUFFICIENT' {
    if (N < 5) return 'INSUFFICIENT'

    if (decaying && gsrV < 0.05 && csrV < 0.05) return 'CONVERGING'
    if (gsrV < 0.02 && csrV < 0.02) return 'STABLE_NOISY'
    if (gsrV > 0.1 || csrV > 0.1) return 'DIVERGING'

    return 'INSUFFICIENT'
  }
}

export const varianceDetector = new CTBLVarianceDecayDetector()
