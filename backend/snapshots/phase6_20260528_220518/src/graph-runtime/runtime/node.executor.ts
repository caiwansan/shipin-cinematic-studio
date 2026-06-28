/**
 * Graph Runtime v1 — Node Executor Runtime
 *
 * Actual execution of a single node step.
 * Delegates to registered executors based on node type.
 */

import type { ExecutionStep } from '../compiler/graph.compiler.js'
import { ExecutionContext } from './context.js'

// ============================================================
// Executor Interface
// ============================================================

export interface NodeExecutor {
  execute(step: ExecutionStep, ctx: ExecutionContext, signal?: AbortSignal): Promise<any>
}

// ============================================================
// Default Executor Registry
// ============================================================

const _executors = new Map<string, NodeExecutor>()

export function registerExecutor(nodeType: string, executor: NodeExecutor): void {
  _executors.set(nodeType, executor)
}

export function getExecutor(nodeType: string): NodeExecutor | null {
  return _executors.get(nodeType) ?? null
}

// ============================================================
// Fallback Executor — if no specific executor is registered
// ============================================================

class DefaultExecutor implements NodeExecutor {
  async execute(step: ExecutionStep, ctx: ExecutionContext, signal?: AbortSignal): Promise<any> {
    // Mock execution: resolve inputs and return a placeholder
    const inputs: Record<string, any> = {}

    for (const input of step.inputs) {
      inputs[input.port] = ctx.resolveInput(input)
    }

    // Simulate work
    if (step.runtime === 'async') {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
    }

    return {
      _status: 'success',
      _nodeId: step.nodeId,
      _type: step.nodeType,
      ...inputs,
    }
  }
}

registerExecutor('*', new DefaultExecutor())

// ============================================================
// Execute a single step
// ============================================================

export async function executeStep(
  step: ExecutionStep,
  ctx: ExecutionContext,
  signal?: AbortSignal,
): Promise<any> {
  const executor = getExecutor(step.nodeType) ?? getExecutor('*')!
  const result = await executor.execute(step, ctx, signal)

  ctx.storeOutput(step.nodeId, result)
  return result
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

