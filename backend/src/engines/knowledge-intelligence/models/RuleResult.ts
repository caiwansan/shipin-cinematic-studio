import type { Evidence } from './Evidence'

export interface RuleResult {
  ruleId: string
  scoreDelta: number
  reason: string
  evidence: Evidence[]
  priority: 'high' | 'medium' | 'low'
}
