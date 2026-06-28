/**
 * kernel-v1/validate.ts — Kernel 权限验证器
 *
 * 运行时强制执行：
 * - UI → READ ONLY（只能读，不能写 EntityGraph/Timeline/EventLog）
 * - Agent → 只能写 EntityGraph，不能写 Timeline/EventLog
 * - TimelineStage → 只能写 Timeline
 * - Execution → 只读
 */

import { KernelCommand, KernelSource, KernelTarget, KernelType } from './types.js'

export class KernelViolation extends Error {
  code = 'KERNEL_VIOLATION'
  constructor(source: KernelSource, target: KernelTarget, type: KernelType) {
    super(`[Kernel] 🚫 ${source} cannot ${type} on ${target}`)
  }
}

/**
 * 权限矩阵
 * 
 * 规则：
 * 1. source='UI' 禁止任何写操作（write=false）
 * 2. source='Agent' 只能写 EntityGraph
 * 3. source='TimelineStage' 只能写 Timeline
 * 4. source='Execution' 只能读（write=false）
 * 
 * 未列出的 source + target 组合默认拒绝
 */
const ACCESS_MATRIX: Record<KernelSource, Partial<Record<KernelTarget, { read: boolean; write: boolean }>>> = {
  UI: {
    EntityGraph: { read: true, write: false },
    Timeline:    { read: true, write: false },
    EventLog:    { read: false, write: false },
  },
  Agent: {
    EntityGraph: { read: true, write: true },
    Timeline:    { read: true, write: false },
    EventLog:    { read: false, write: false },
  },
  TimelineStage: {
    EntityGraph: { read: true, write: false },
    Timeline:    { read: true, write: true },
    EventLog:    { read: false, write: false },
  },
  Execution: {
    EntityGraph: { read: true, write: false },
    Timeline:    { read: false, write: false },
    EventLog:    { read: false, write: false },
  },
}

export class KernelValidator {
  /**
   * 验证命令是否合法
   * @throws KernelViolation 如果违反权限
   */
  validate(cmd: KernelCommand): void {
    // 基础校验
    if (!cmd.payload.projectId) {
      throw new Error('[Kernel] missing payload.projectId')
    }
    if (!cmd.source || !cmd.target || !cmd.type) {
      throw new Error('[Kernel] missing source/target/type')
    }

    // 权限矩阵查询
    const sourceMatrix = ACCESS_MATRIX[cmd.source]
    if (!sourceMatrix) {
      throw new KernelViolation(cmd.source, cmd.target, cmd.type)
    }

    const targetAccess = sourceMatrix[cmd.target]
    if (!targetAccess) {
      throw new KernelViolation(cmd.source, cmd.target, cmd.type)
    }

    // 写操作拦截
    const isWrite = cmd.type.startsWith('ENTITY_') || cmd.type.startsWith('TIMELINE_')
    if (isWrite && !targetAccess.write) {
      throw new KernelViolation(cmd.source, cmd.target, cmd.type)
    }
  }
}
