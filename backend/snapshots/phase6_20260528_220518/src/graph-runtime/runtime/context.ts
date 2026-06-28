/**
 * Graph Runtime v1 — Execution Context
 *
 * Shared state across a single graph execution.
 * Stores node outputs and enables data flow resolution across steps.
 */

import type { ResolvedInput } from '../compiler/graph.compiler.js'

export class ExecutionContext {
  private store = new Map<string, any>()
  private events: ExecutionEvent[] = []

  storeOutput(nodeId: string, output: any): void {
    this.store.set(nodeId, output)
    this.events.push({ type: 'node_completed', nodeId, timestamp: Date.now() })
  }

  getOutput(nodeId: string): any {
    return this.store.get(nodeId)
  }

  resolveInput(input: ResolvedInput): any {
    const data = this.store.get(input.sourceNodeId)
    if (!data) {
      if (input.required) {
        throw new Error(`Required input "${input.port}" depends on node "${input.sourceNodeId}" which has no output`)
      }
      return undefined
    }

    // Transform if specified
    if (input.transform && data.transform) {
      const transformer = data.transform[input.transform]
      if (transformer) return transformer(data)
    }

    return data
  }

  getEvents(): ExecutionEvent[] {
    return [...this.events]
  }
}

export interface ExecutionEvent {
  type: 'node_started' | 'node_completed' | 'node_failed' | 'node_skipped'
  nodeId: string
  timestamp: number
  error?: string
}

export function createContext(): ExecutionContext {
  return new ExecutionContext()
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

