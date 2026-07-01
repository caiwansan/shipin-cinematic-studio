/**
 * benchmark/calculator/bii-calculator.ts — BII 总分计算器
 *
 * BII = Σ(wi × si) / Σ(wi)
 * 权重从配置读取，非硬编码。
 * Formula Version 用于追溯。
 */
import { BIIResult, DimensionScore } from '../types'

interface BIIFormulaConfig {
  weights: Record<string, number>
  formulaVersion: string
}

export class BIICalculator {
  private formulaVersion = 'bii-v1.0'
  private config: BIIFormulaConfig

  constructor(config?: Partial<BIIFormulaConfig>) {
    this.config = {
      weights: DEFAULT_WEIGHTS,
      formulaVersion: this.formulaVersion,
      ...config,
    }
  }

  /**
   * 计算 BII 总分
   */
  calculate(dimensions: DimensionScore[]): BIIResult {
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0)
    
    if (totalWeight === 0) {
      return {
        biiScore: 0,
        biiGrade: 'C',
        confidence: 0,
        dimensions,
      }
    }
    
    const biiScore = dimensions.reduce((sum, d) => sum + (d.score * d.weight), 0) / totalWeight
    const roundedScore = Math.round(biiScore)
    
    const confidence = this.calculateConfidence(dimensions)
    
    return {
      biiScore: roundedScore,
      biiGrade: this.getGrade(roundedScore),
      confidence,
      dimensions,
    }
  }

  /**
   * 置信度 = 各维度 confidence 的调和平均
   * 维度 confidence = 该维度 claim 数量 / 期望数量
   */
  private calculateConfidence(dimensions: DimensionScore[]): number {
    const confidences = dimensions.map(d => {
      const total = d.evaluations.length
      const scored = d.evaluations.filter(e => e.score >= 0).length
      return total > 0 ? scored / total : 0
    })
    
    const avg = confidences.length > 0
      ? confidences.reduce((s, c) => s + c, 0) / confidences.length
      : 0
    
    return Math.round(avg * 100) / 100
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A+'
    if (score >= 75) return 'A'
    if (score >= 55) return 'B+'
    if (score >= 35) return 'B'
    if (score >= 15) return 'C+'
    return 'C'
  }
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  visibility: 0.10,
  understanding: 0.15,
  accuracy: 0.20,
  citation: 0.10,
  recommendation: 0.20,
  comparative_preference: 0.15,
  freshness: 0.05,
  consistency: 0.05,
}
