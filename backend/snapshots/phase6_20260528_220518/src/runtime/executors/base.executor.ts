/**
 * Unified Executor Interface
 *
 * Every node type in the graph has a corresponding executor.
 * Executors speak to LLM providers through the Provider Layer.
 */

import type { ExecutionContext } from '../../graph-runtime/runtime/context.js'

// ============================================================
// Input / Output / Result
// ============================================================

export interface ExecutorInput {
  nodeId: string
  nodeType: string
  config: Record<string, any>
  inputs: Record<string, any>          // resolved from execution context
  ctx: ExecutionContext
  signal?: AbortSignal
}

export interface ExecutorResult {
  success: boolean
  outputs: Record<string, any>
  metadata?: {
    durationMs: number
    tokensUsed?: number
    model?: string
    provider?: string
  }
  error?: string
}

// ============================================================
// Executor Interface
// ============================================================

export interface IExecutor {
  type: string
  execute(input: ExecutorInput): Promise<ExecutorResult>
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

