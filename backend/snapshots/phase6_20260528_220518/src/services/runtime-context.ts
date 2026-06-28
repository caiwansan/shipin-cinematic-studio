/**
 * services/runtime-context.ts — Trace-only Context (Phase 1-D)
 *
 * Phase 1-D 宪法降级：
 *   ALS 仅承载 trace/logging 信息
 *   禁止承载 secrets / provider / model
 *   RuntimePayload 已替代 ALS 作为正式 runtime 链路
 *
 * 设计原则：
 *   1. 每个请求/任务创建一个 TraceContext
 *   2. 仅包含 traceId, requestId, timing 信息
 *   3. 任何业务 runtime 数据必须通过 RuntimePayload 显式传递
 */

import { AsyncLocalStorage } from 'async_hooks'
import crypto from 'crypto'

// ============ Types ============

export type ExecutionStage = 'init' | 'running' | 'checkpoint' | 'completed' | 'failed'

/**
 * TraceContext — Phase 1-D 宪法降级
 * 仅包含 trace/logging 信息，禁止承载业务 runtime 数据
 */
export interface RuntimeContext {
  /** 全链路追踪 ID */
  requestId: string
  traceId?: string

  /** 会话 / 用户标识（仅用于日志，不可用于权限判断） */
  sessionId?: string
  userId?: string

  /** 执行标识 */
  executionId?: string
  taskId?: string
  projectId?: string

  /** 执行阶段（仅日志使用） */
  stage?: ExecutionStage

  /** 创建时间戳 */
  createdAt: number
}

// ============ Context 工厂 ============

export type ContextInit = {
  requestId?: string
  userId?: string
  taskId?: string
  projectId?: string
}

export function createContext(init?: ContextInit): RuntimeContext {
  const now = Date.now()
  return {
    requestId: init?.requestId || crypto.randomUUID(),
    userId: init?.userId,
    taskId: init?.taskId,
    projectId: init?.projectId,
    createdAt: now,
  }
}

export function cloneContext(ctx: RuntimeContext, overrides?: Partial<RuntimeContext>): RuntimeContext {
  return {
    ...ctx,
    ...overrides,
    createdAt: Date.now(),
  }
}

// ============ AsyncLocalStorage 实例 ============

const asyncLocalStorage = new AsyncLocalStorage<RuntimeContext>()

// ============ API ============

/**
 * 在 context 中执行函数
 * 每个 HTTP handler / worker 入口调用一次
 */
export function withRuntimeContext<T>(
  ctx: RuntimeContext,
  fn: () => Promise<T>
): Promise<T> {
  return asyncLocalStorage.run(ctx, fn)
}

/**
 * 获取当前请求/任务的 TraceContext
 * Phase 1-D: 仅用于 trace/logging，禁止读取业务 secrets
 */
export function getRuntimeContext(): RuntimeContext | undefined {
  return asyncLocalStorage.getStore()
}

/**
 * 获取当前 context 可序列化的快照（仅 trace 字段）
 * 用于 checkpoint 存储或 worker 传输
 */
export function getContextSnapshot(): SnapshotPayload | undefined {
  const ctx = getRuntimeContext()
  if (!ctx) return undefined
  return {
    requestId: ctx.requestId,
    userId: ctx.userId,
    taskId: ctx.taskId,
    projectId: ctx.projectId,
  }
}

export interface SnapshotPayload {
  requestId: string
  userId?: string
  taskId?: string
  projectId?: string
}

/**
 * 从 snapshot 重建 context（仅 trace 字段）
 * Phase 1-D: 业务 runtime 数据需通过 RuntimePayload 显式传递
 */
export function restoreContextFromSnapshot(
  snapshot: SnapshotPayload
): RuntimeContext {
  return {
    requestId: snapshot.requestId,
    userId: snapshot.userId,
    taskId: snapshot.taskId,
    projectId: snapshot.projectId,
    createdAt: Date.now(),
  }
}
