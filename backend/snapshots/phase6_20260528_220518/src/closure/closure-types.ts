/**
 * closure/closure-types.ts — Legacy Closure Protocol type definitions
 *
 * L0-L3 classification + closure validation types
 */

export type LegacyClass = 'L0_DEAD' | 'L1_ISOLATED' | 'L2_SHADOW' | 'L3_COUPLED'

export interface ClosureNode {
  /** Relative file path */
  file: string
  /** Classification */
  class: LegacyClass
  /** Why classified this way */
  reason: string
  /** Static import count (incoming) */
  staticIncoming: number
  /** Execution graph reachability */
  executionReachable: boolean
  /** Type drift: has duplicate/partial override interfaces */
  typeDrift: boolean
  /** Suggested action: DELETE | REFACTOR | ASSERT_INJECT | KEEP */
  action: 'DELETE' | 'REFACTOR' | 'ASSERT_INJECT' | 'KEEP'
}

export interface ClosureGraphState {
  totalFiles: number
  staticGraphSize: number
  executionGraphSize: number
  unreachableNodes: number
}

export interface ClosureSummary {
  graph: ClosureGraphState
  classification: Record<LegacyClass, number>
  violations: ClosureNode[]
  typeDrifts: string[]
  finalScore: number // 0-100
  timestamp: string
}
