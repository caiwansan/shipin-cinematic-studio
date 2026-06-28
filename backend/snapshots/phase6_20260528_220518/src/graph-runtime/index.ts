/**
 * Graph Runtime v1 — Barrel Export
 *
 * Single entry point for the entire graph runtime system.
 */

// Core Types
export type {
  Graph,
  GraphNode,
  GraphEdge,
  NodeIOSchema,
  EdgeRelation,
  EdgeTypeV1,
  EdgeCondition,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './core/graph.types.js'

// Node Schema
export { getNodeSchema, registerNodeSchema, getAllNodeSchemas } from './core/node.schema.js'

// Edge Contract Builder
export {
  buildEdge,
  buildDataflowEdge,
  buildFallbackEdge,
  buildConditionEdge,
  type EdgeContractInput,
} from './core/edge.contract.js'

// Validator
export { GraphValidator, createValidator } from './validator/graph.validator.js'

// Compiler
export {
  compileGraph,
  type ExecutionPlan,
  type ExecutionStep,
  type ResolvedInput,
} from './compiler/graph.compiler.js'

// Runtime
export { GraphRuntime, createRuntime, type RuntimeResult } from './runtime/graph.runtime.js'
export { ExecutionContext, createContext, type ExecutionEvent } from './runtime/context.js'
export { executeStep, registerExecutor, getExecutor, type NodeExecutor } from './runtime/node.executor.js'
export { resolveIncomingEdges, type EdgeData } from './runtime/edge.resolver.js'

// Registry
export { registerBuiltinExecutors } from './registry/node.registry.js'

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

