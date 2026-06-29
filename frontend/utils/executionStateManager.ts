// ============================================================
// ExecutionStateManager — GEO 执行状态模型 (P2.2)
//
// 不是 store，是纯 runtime state manager。
// 管理每个 capability 的执行状态机。
//
// 状态流转:
//   IDLE ──→ EXECUTING ──→ WATCHING ──→ STABLE
//                                      └──→ DRIFTED ──→ (re-execute)
//                         └──→ FAILED
//
// 约束:
//   - 不新增 API
//   - 不改 hydrate contract
//   - 不动 PermissionService
//   - 不依赖 store
// ============================================================

import type { CapabilityId } from './geoCapability'

/**
 * Execution State（执行状态）
 */
export type ExecutionState =
  | 'IDLE'        // 未执行过
  | 'EXECUTING'   // API 已调用，等待返回
  | 'WATCHING'    // 执行完成，watcher 跟踪中
  | 'STABLE'      // watcher 稳定（mismatch=0）
  | 'DRIFTED'     // watcher 检测到不一致
  | 'FAILED'      // 执行失败

/**
 * 单次执行上下文
 */
export interface ExecutionContext {
  projectId: string
  capabilityId: CapabilityId
  state: ExecutionState
  lastRunAt?: number        // 上次执行时间戳
  startedAt?: number        // 当前这次开始时间
  duration?: number         // 上次执行耗时 (ms)
  result?: any              // API 返回结果
  error?: string            // 失败时的错误信息
  mismatchCount?: number    // watcher 检测到的不一致数
}

/**
 * ExecutionStateManager — 纯 runtime manager
 *
 * 使用方式:
 *   const mgr = ExecutionStateManager.getInstance()
 *   mgr.start(capabilityId)  → sets EXECUTING
 *   mgr.complete(capabilityId, result) → sets WATCHING
 *   mgr.markStable(capabilityId) → sets STABLE
 *   mgr.markDrifted(capabilityId, count) → sets DRIFTED
 *   mgr.fail(capabilityId, error) → sets FAILED
 *   mgr.getState(capabilityId) → ExecutionContext
 */
export class ExecutionStateManager {
  private static instance: ExecutionStateManager
  private states: Map<string, ExecutionContext> = new Map()
  private listeners: Array<(ctx: ExecutionContext) => void> = []

  private constructor() {}

  static getInstance(): ExecutionStateManager {
    if (!ExecutionStateManager.instance) {
      ExecutionStateManager.instance = new ExecutionStateManager()
    }
    return ExecutionStateManager.instance
  }

  private key(projectId: string, capabilityId: CapabilityId): string {
    return `${projectId}:${capabilityId}`
  }

  /**
   * 监听状态变更
   */
  onStateChange(listener: (ctx: ExecutionContext) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  private notify(ctx: ExecutionContext): void {
    this.listeners.forEach(fn => fn(ctx))
  }

  /**
   * 开始执行 → IDLE → EXECUTING
   */
  start(projectId: string, capabilityId: CapabilityId): void {
    const ctx: ExecutionContext = {
      projectId,
      capabilityId,
      state: 'EXECUTING',
      startedAt: Date.now(),
    }
    this.states.set(this.key(projectId, capabilityId), ctx)
    this.notify(ctx)
  }

  /**
   * 执行完成 → EXECUTING → WATCHING
   */
  complete(projectId: string, capabilityId: CapabilityId, result?: any): void {
    const key = this.key(projectId, capabilityId)
    const prev = this.states.get(key)
    const now = Date.now()
    const ctx: ExecutionContext = {
      projectId,
      capabilityId,
      state: 'WATCHING',
      lastRunAt: now,
      startedAt: prev?.startedAt,
      duration: prev?.startedAt ? now - prev.startedAt : undefined,
      result,
    }
    this.states.set(key, ctx)
    this.notify(ctx)
  }

  /**
   * Watcher 稳定 → WATCHING → STABLE
   */
  markStable(projectId: string, capabilityId: CapabilityId): void {
    const key = this.key(projectId, capabilityId)
    const prev = this.states.get(key)
    const ctx: ExecutionContext = {
      ...(prev || { projectId, capabilityId }),
      state: 'STABLE',
      mismatchCount: 0,
    }
    this.states.set(key, ctx)
    this.notify(ctx)
  }

  /**
   * Watcher 检测到不一致 → WATCHING → DRIFTED
   */
  markDrifted(projectId: string, capabilityId: CapabilityId, mismatchCount: number): void {
    const key = this.key(projectId, capabilityId)
    const prev = this.states.get(key)
    const ctx: ExecutionContext = {
      ...(prev || { projectId, capabilityId }),
      state: 'DRIFTED',
      mismatchCount,
    }
    this.states.set(key, ctx)
    this.notify(ctx)
  }

  /**
   * 执行失败 → EXECUTING → FAILED
   */
  fail(projectId: string, capabilityId: CapabilityId, error: string): void {
    const key = this.key(projectId, capabilityId)
    const prev = this.states.get(key)
    const ctx: ExecutionContext = {
      projectId,
      capabilityId,
      state: 'FAILED',
      error,
      lastRunAt: prev?.startedAt,
      startedAt: prev?.startedAt,
      duration: prev?.startedAt ? Date.now() - prev.startedAt : undefined,
    }
    this.states.set(key, ctx)
    this.notify(ctx)
  }

  /**
   * 重置为 IDLE（用于重新执行）
   */
  reset(projectId: string, capabilityId: CapabilityId): void {
    this.states.delete(this.key(projectId, capabilityId))
    this.notify({ projectId, capabilityId, state: 'IDLE' })
  }

  /**
   * 获取某个 capability 的执行状态
   */
  getState(projectId: string, capabilityId: CapabilityId): ExecutionContext {
    const ctx = this.states.get(this.key(projectId, capabilityId))
    return ctx || { projectId, capabilityId, state: 'IDLE' }
  }

  /**
   * 获取项目所有 capability 的状态（用于面板展示）
   */
  getAllStates(projectId: string): ExecutionContext[] {
    const prefix = `${projectId}:`
    const result: ExecutionContext[] = []
    this.states.forEach((ctx, key) => {
      if (key.startsWith(prefix)) result.push(ctx)
    })
    return result
  }

  /**
   * 清除项目所有状态
   */
  clearProject(projectId: string): void {
    const prefix = `${projectId}:`
    this.states.forEach((_, key) => {
      if (key.startsWith(prefix)) this.states.delete(key)
    })
  }
}

/**
 * 状态展示辅助函数
 */
export const ExecutionStateDisplay: Record<ExecutionState, { label: string; color: string; icon: string }> = {
  IDLE:       { label: '等待执行',  color: '#6b7280', icon: '⏸️' },
  EXECUTING:  { label: '执行中',    color: '#f59e0b', icon: '⏳' },
  WATCHING:   { label: '对账中',    color: '#3b82f6', icon: '👁️' },
  STABLE:     { label: '已同步',    color: '#22c55e', icon: '✅' },
  DRIFTED:    { label: '不一致',    color: '#f97316', icon: '⚠️' },
  FAILED:     { label: '执行失败',  color: '#ef4444', icon: '❌' },
}
