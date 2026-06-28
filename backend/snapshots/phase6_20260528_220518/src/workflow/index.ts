/**
 * workflow/index.ts — 统一导出
 */
export { WorkflowEngine, initWorkflowEngine, getWorkflowEngine } from './workflow-engine.js'
export { resolveNodeExecutionParams } from './node-resolver.js'
export type { UserModelConfigV2Flat, ResolvedExecutionParams } from './node-resolver.js'
export type { WorkflowNode, WorkflowGraph, WorkflowNodeType, ExecuteNodeRequest, ExecuteNodeResponse } from './types.js'
