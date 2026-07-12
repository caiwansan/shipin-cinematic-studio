import type { Assessment } from './Assessment'
import type { Evidence } from './Evidence'

export interface Insight {
  version: '1.0'
  assessment: Assessment
  quality: {
    score: number
    label: 'A' | 'B' | 'C'
    reason: string
  }
  recommendation: {
    priority: 'High' | 'Medium' | 'Low'
    expectedBenefit: string
    estimatedImpact: string
    reason: string
  }
  evidence: Evidence[]
}
