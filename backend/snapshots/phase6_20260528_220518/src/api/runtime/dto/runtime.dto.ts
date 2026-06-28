/**
 * Runtime API — DTOs
 */

import type { Graph } from '../../../graph-runtime/core/graph.types.js'

// ============================================================
// Validate
// ============================================================

export interface ValidateRequest {
  graph: Graph
}

export interface ValidateResponse {
  ok: boolean
  errors: Array<{
    type: string
    edgeId?: string
    nodeId?: string
    message: string
  }>
  warnings: Array<{
    type: string
    edgeId?: string
    nodeId?: string
    message: string
  }>
}

// ============================================================
// Compile
// ============================================================

export interface CompileRequest {
  graph: Graph
}

export interface CompileResponse {
  ok: boolean
  executionPlan: {
    stages: string[][]       // e.g. [["input"], ["storyboard"], ["video_gen", "preview"]]
    topologicalLevels: number
    totalSteps: number
    maxParallel: number
    steps: Array<{
      nodeId: string
      nodeType: string
      label: string
      phase: number
      dependencies: string[]
    }>
  }
  errors?: string[]
}

// ============================================================
// Execute
// ============================================================

export interface ExecuteRequest {
  graph: Graph
  pipelineId?: string
}

export interface ExecuteResponse {
  runId: string
  status: 'pending' | 'running'
  graphId: string
  startedAt: number
}

// ============================================================
// Run Status
// ============================================================

export interface RunStatusResponse {
  runId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: number
  finishedAt?: number
  nodeStates: Record<string, {
    status: string
    startedAt?: number
    finishedAt?: number
    durationMs?: number
    error?: string
  }>
  progress: {
    total: number
    completed: number
    failed: number
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

