/**
 * telemetry-hook.ts — Phase A-0.6 Observability Enrichment
 *
 * ============================================================
 * Pipeline 级 Telemetry Hook 注入器
 * ============================================================
 *
 * 职责：在 Pipeline 各 Step 完成后统一注入 Trace Event。
 * 不侵入 Agent 内部逻辑。
 *
 * 设计原则：
 *   1. TelemetryHook 是 Pipeline 生命周期的一部分，不是 Agent 的一部分
 *   2. Hook.emit() 只记录，不转换 payload
 *   3. 所有 Agent 输出原样写入 Trace
 *   4. 禁止在 Agent 内部直接调用 telemetry.recordEvent()
 *
 * 宪法约束：
 *   - 不改 Agent execute() 逻辑
 *   - 不改 Agent 内部状态
 *   - 只读取 Agent 输出 → 写入 Trace
 */

import type { StepEventType } from './event-types.js'

// ============================================================
// 1. Telemetry Hook
// ============================================================

export interface TelemetryRecordEvent {
  (traceId: string, eventType: string, agentName: string, payload: Record<string, unknown>): void
}

export class TelemetryHook {
  private stepIndex = 0

  constructor(
    private readonly telemetry: { recordEvent: TelemetryRecordEvent },
    private readonly traceId: string,
  ) {}

  /**
   * 在 Pipeline Step 完成后注入事件
   *
   * @param type 事件类型（StepEventType）
   * @param agentName Agent 名称
   * @param payload Agent 输出（原样记录）
   */
  emit(type: StepEventType, agentName: string, payload: Record<string, unknown>): void {
    this.stepIndex++
    this.telemetry.recordEvent(this.traceId, type, agentName, payload)
  }

  /**
   * 获取当前已发出的 Step 数量
   */
  get completedSteps(): number {
    return this.stepIndex
  }

  /**
   * 重置计数器（测试用）
   */
  reset(): void {
    this.stepIndex = 0
  }
}
