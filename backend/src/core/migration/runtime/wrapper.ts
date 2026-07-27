/**
 * BETA-ARCH-03.0.2
 * Migration Runtime — Telemetry Wrapper
 * 
 * 核心执行器：封装 Adapter + Tracker，确保：
 * 1. Adapter 迁移逻辑正确执行
 * 2. 遥测记录闭环
 * 3. 遥测失败不破坏业务结果
 */

import { performance } from 'perf_hooks'
import type {
  MigrationAdapter,
  MigrationTracker,
  MigrationUsageLogEntry,
  MigrationResult,
} from './types.js'

/**
 * 迁移遥测包装器
 */
export class MigrationTelemetryWrapper {
  private tracker: MigrationTracker

  constructor(tracker: MigrationTracker) {
    this.tracker = tracker
  }

  /**
   * 执行迁移并记录遥测
   * 
   * 保证：
   * - Adapter 是唯一的业务逻辑
   * - Tracker 失败不影响返回结果
   */
  async execute<TInput, TOutput>(
    adapter: MigrationAdapter<TInput, TOutput>,
    input: TInput,
    options?: { caller?: string; metadata?: Record<string, unknown> }
  ): Promise<MigrationResult<TOutput>> {
    const caller = options?.caller ?? 'system'
    const metadata = options?.metadata ?? {}
    const start = performance.now()

    let data: TOutput
    let status: 'SUCCESS' | 'FAILURE' = 'SUCCESS'

    try {
      data = await adapter.resolve(input)
    } catch (err: any) {
      status = 'FAILURE'
      // 即使业务失败，仍然记录遥测
      await this.safeTrack({
        adapter: adapter.name,
        source: adapter.source,
        target: adapter.target,
        status,
        durationMs: Math.round(performance.now() - start),
        callCount: 1,
        caller,
        metadata: {
          ...metadata,
          error: err.message ?? String(err),
        },
      })
      throw err
    }

    const durationMs = Math.round(performance.now() - start)

    // 业务成功 — 记录遥测
    await this.safeTrack({
      adapter: adapter.name,
      source: adapter.source,
      target: adapter.target,
      status,
      durationMs,
      callCount: 1,
      caller,
      metadata,
    })

    return {
      data,
      telemetry: {
        status,
        durationMs,
      },
    }
  }

  /**
   * 安全记录遥测 — 遥测失败不抛出
   */
  private async safeTrack(entry: MigrationUsageLogEntry): Promise<void> {
    try {
      await this.tracker.log(entry)
    } catch (err: any) {
      // 遥测失败 → console.error 上报，不影响业务结果
      console.error('[MigrationTelemetry] Tracker failed:', err.message ?? String(err))
    }
  }
}
