/**
 * BETA-ARCH-03.0.2
 * Migration Runtime — Shared Types
 * 
 * 迁移运行时核心类型定义。
 */

/**
 * Adapter 标准接口 — 所有迁移适配器必须实现
 */
export interface MigrationAdapter<TInput = unknown, TOutput = unknown> {
  /** Adapter 标识名 */
  name: string
  /** 数据来源（遗留系统实体） */
  source: string
  /** 迁移目标（核心实体） */
  target: string
  /** 执行迁移逻辑 */
  resolve(input: TInput): Promise<TOutput>
}

/**
 * Tracker 标准接口 — 遥测追踪器
 */
export interface MigrationTracker {
  log(entry: MigrationUsageLogEntry): Promise<void>
}

/**
 * MigrationUsageLog 条目 — 写入数据库的遥测记录
 */
export interface MigrationUsageLogEntry {
  adapter: string
  source: string
  target: string
  status: 'SUCCESS' | 'FAILURE'
  durationMs: number
  callCount?: number
  caller?: string
  metadata?: Record<string, unknown>
}

/**
 * Telemetry Wrapper 执行结果
 */
export interface MigrationResult<T> {
  data: T
  telemetry: {
    status: 'SUCCESS' | 'FAILURE' | 'TELEMETRY_ERROR'
    durationMs: number
  }
}
