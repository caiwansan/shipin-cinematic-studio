import type { RuleResult } from './RuleResult'

export interface DimensionScore {
  score: number
  label: string
  reason: string
  ruleResults: RuleResult[]
}

export interface Assessment {
  version: '1.0'
  coverage: DimensionScore
  freshness: DimensionScore
  authority: DimensionScore
  consistency: DimensionScore
}
