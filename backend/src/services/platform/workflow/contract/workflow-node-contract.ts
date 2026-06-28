// ============================================================
// Workflow Node Contract (KMKI-PLAT-011)
// Unified interface for all workflow node types
// ============================================================

import type { WorkflowContext, NodeExecutionResult } from '../types.js'

/**
 * WorkflowNodeContract — all node types must implement this interface.
 */
export interface WorkflowNodeContract {
  /** Node type identifier */
  type: string

  /** Initialize the node with its configuration */
  initialize(config: Record<string, any>): Promise<void>

  /** Validate the node's configuration and input */
  validate(input: Record<string, any>): Promise<boolean>

  /** Execute the node's logic */
  execute(input: Record<string, any>, ctx: WorkflowContext): Promise<NodeExecutionResult>

  /** Pause the node (for long-running node types) */
  pause(): Promise<void>

  /** Resume the node */
  resume(): Promise<void>

  /** Cancel the node execution */
  cancel(): Promise<void>

  /** Rollback the node's effects */
  rollback(): Promise<void>

  /** Mark the node as complete */
  complete(output: Record<string, any>): Promise<NodeExecutionResult>
}

/**
 * BaseWorkflowNode — abstract base class for all node types.
 */
export abstract class BaseWorkflowNode implements WorkflowNodeContract {
  public abstract type: string
  protected config: Record<string, any> = {}

  async initialize(config: Record<string, any>): Promise<void> {
    this.config = config
  }

  abstract validate(input: Record<string, any>): Promise<boolean>

  abstract execute(input: Record<string, any>, ctx: WorkflowContext): Promise<NodeExecutionResult>

  async pause(): Promise<void> {
    // Default: no-op
  }

  async resume(): Promise<void> {
    // Default: no-op
  }

  async cancel(): Promise<void> {
    // Default: no-op
  }

  async rollback(): Promise<void> {
    // Default: no-op
  }

  async complete(output: Record<string, any>): Promise<NodeExecutionResult> {
    return {
      success: true,
      output,
    }
  }
}

// ─── Node Type Registry ───

class NodeTypeRegistry {
  private nodes: Map<string, new () => BaseWorkflowNode> = new Map()

  register(type: string, nodeClass: new () => BaseWorkflowNode): void {
    this.nodes.set(type, nodeClass)
  }

  get(type: string): new () => BaseWorkflowNode | undefined {
    return this.nodes.get(type)
  }

  has(type: string): boolean {
    return this.nodes.has(type)
  }

  list(): string[] {
    return Array.from(this.nodes.keys())
  }

  create(type: string): BaseWorkflowNode | undefined {
    const NodeClass = this.nodes.get(type)
    if (!NodeClass) return undefined
    return new NodeClass()
  }
}

export const nodeTypeRegistry = new NodeTypeRegistry()
