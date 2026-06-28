/**
 * kernel-v1/index.ts — Kernel v1 统一导出
 */

export { CanonicalKernel, kernel } from './kernel.js'
export { KernelValidator, KernelViolation } from './validate.js'
export { EventLogStore } from './event-log.js'
export { EntityGraphStore } from './entity-graph.js'

export type {
  KernelCommand,
  KernelSource,
  KernelTarget,
  KernelType,
  KernelPayload,
  EventRecord,
  EntityNode,
  EntityGraph,
  KernelCommandResult,
  KernelReadResult,
} from './types.js'
