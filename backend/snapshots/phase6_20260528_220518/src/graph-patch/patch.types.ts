/**
 * Patch Engine — Types
 *
 * Patch = controlled structural mutation proposal
 *
 * Principle: Patch is NOT an execution order.
 * Patch IS a structural diff proposal that requires:
 *   1. Validation (won't break the graph)
 *   2. Preview (show the diff)
 *   3. User confirmation (apply)
 *   4. Rollback capability (undo)
 */

import type { Pipeline } from '../studio/graph.model.js'
type Graph = Pipeline

// ── Operations ──

export type PatchOperationType = 'SPLIT' | 'CACHE' | 'PARALLELIZE' | 'REPLACE_MODEL'

export interface SplitOperation {
  type: 'SPLIT'
  nodeId: string
  /** If known, how to split (e.g. "draft+refine" for storyboard) */
  strategy?: string
}

export interface CacheOperation {
  type: 'CACHE'
  nodeId: string
}

export interface ParallelizeOperation {
  type: 'PARALLELIZE'
  nodeIds: string[]
}

export interface ReplaceModelOperation {
  type: 'REPLACE_MODEL'
  nodeId: string
  model: string
}

export type PatchOperation =
  | SplitOperation
  | CacheOperation
  | ParallelizeOperation
  | ReplaceModelOperation

// ── Node/Edge diff — what changed in the graph ──

export interface NodeDiff {
  id: string
  type: 'add' | 'remove' | 'modify'
  /** Original node snapshot (for rollback) */
  original?: Record<string, any>
  /** Proposed new state */
  proposed?: Record<string, any>
}

export interface EdgeDiff {
  id: string
  type: 'add' | 'remove' | 'modify'
  source?: string
  target?: string
  original?: Record<string, any>
  proposed?: Record<string, any>
}

export interface GraphDiff {
  nodes: NodeDiff[]
  edges: EdgeDiff[]
}

// ── Patch Plan ──

export interface PatchPlan {
  /** Unique patch ID for traceability */
  patchId: string
  /** Derived from which optimization run */
  runId: string
  /** Operations that produced this plan */
  operations: PatchOperation[]
  /** The full graph after applying all patches (preview) */
  previewGraph: Graph
  /** What actually changed */
  diff: GraphDiff
  /** Validation result */
  valid: boolean
  /** If invalid, why */
  validationErrors?: string[]
  /** Expected performance gain estimate */
  expectedGain: {
    latencyPct?: number
    costPct?: number
  }
  /** Timestamp */
  generatedAt: number
}

// ── Patch Execution ──

export type PatchStatus = 'pending' | 'applied' | 'rolled_back' | 'failed'

export interface PatchRecord {
  patchId: string
  plan: PatchPlan
  status: PatchStatus
  appliedAt?: number
  rolledBackAt?: number
  /** Snapshot of the graph BEFORE patch (for rollback) */
  beforeGraphSnapshot: Graph
}
