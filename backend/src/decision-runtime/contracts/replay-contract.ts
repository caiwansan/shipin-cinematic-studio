/**
 * replay-contract.ts — Decision Runtime Replay Contract
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-0: Decision Runtime Contract Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件定义 Decision Runtime 的回放能力契约。
 *
 * 回放是昆仑镜的核心能力要求之一：
 *   任意一次决策推荐都必须能：
 *     1. 重新回放完整流程
 *     2. 在任意节点修改后重新评分
 *     3. 重新生成报告
 *
 * 宪法：
 *   1. Replay 的输入永远是 DecisionSnapshot
 *   2. Replay 不修改原始 Snapshot，总是产生新 Snapshot
 *   3. 回放可以是全量（从头到尾）或增量（从指定节点开始）
 *   4. 回放结果必须与原始执行在相同输入下保持一致
 *
 * @phase decision-runtime
 */

import type { DecisionSnapshot } from './decision-snapshot.js'
import type { DecisionNodeType } from './decision-ontology.js'

// ============================================================
// 1. Replay Mode
// ============================================================

export enum ReplayMode {
  /**
   * 全量回放 — 从 RequirementAgent 到 ReportAgent 完整执行
   * 适用于：
   *   - 验证 Runtime 输出一致性
   *   - 恢复失败的执行
   *   - 测试新版本的 Agent
   */
  FULL = 'FULL',

  /**
   * 增量回放 — 从指定 Node 开始执行
   * 适用于：
   *   - 修改 Scoring Agent 后只需重新评分
   *   - 修改 Report Agent 后只需重新生成报告
   *   - 调试特定 Agent
   */
  INCREMENTAL = 'INCREMENTAL',
}

// ============================================================
// 2. Replay Request
// ============================================================

export interface ReplayRequest {
  /** 要回放的 Snapshot */
  snapshot: DecisionSnapshot

  /** 回放模式 */
  mode: ReplayMode

  /**
   * 增量模式下，从此节点类型开始执行
   * 全量模式下忽略此字段
   */
  startFrom?: DecisionNodeType

  /**
   * 增量模式下，可选地覆盖指定节点的输入
   * key: DecisionNodeType
   * value: 覆盖数据（JSON 序列化）
   */
  overrides?: Record<string, unknown>

  /** 回放原因（用于日志/审计） */
  reason?: string
}

// ============================================================
// 3. Replay Result
// ============================================================

export interface ReplayResult {
  /** 新生成的 Snapshot */
  snapshot: DecisionSnapshot

  /** 回放模式 */
  mode: ReplayMode

  /** 实际执行的节点列表（按顺序） */
  executedNodes: DecisionNodeType[]

  /** 每个节点的执行耗时（毫秒） */
  nodeLatencies: Record<string, number>

  /** 总耗时（毫秒） */
  totalLatencyMs: number

  /** 是否与原始输出一致（全量模式下比较） */
  consistent: boolean | null // null 表示无法比较（增量模式）

  /** 是否为回放执行（区别于首次执行） */
  isReplay: true
}

// ============================================================
// 4. Replay Contract 校验
// ============================================================

export function validateReplayRequest(req: ReplayRequest): string[] {
  const errors: string[] = []

  if (!req.snapshot) {
    errors.push('replay.snapshot 为空')
    return errors
  }

  if (req.mode === ReplayMode.INCREMENTAL && !req.startFrom) {
    errors.push('增量模式下必须指定 startFrom')
  }

  return errors
}

// ============================================================
// 5. Replay Promise（接口契约）
// ============================================================

/**
 * Decision Runtime 必须实现的 Replay 接口
 *
 * 任意 Decision Runtime 实现都必须提供此方法：
 *   replay(request: ReplayRequest): Promise<ReplayResult>
 */
export interface Replayable {
  replay(request: ReplayRequest): Promise<ReplayResult>
}
