/**
 * decision-snapshot.ts — Decision Runtime Snapshot Contract
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-0: Decision Runtime Contract Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件定义 Decision Runtime 的快照契约。
 *
 * 为什么这是最重要的文件：
 *   昆仑镜之前犯过的错误——WorkbenchSnapshot 缺失导致 Runtime 不可恢复。
 *   Decision Runtime 从第一天起就必须具备持久化能力。
 *
 * 宪法：
 *   1. Snapshot 是 Decision Runtime 的唯一持久化形态
 *   2. 任何 Agent 完成工作后必须产生可序列化的中间状态
 *   3. Snapshot 必须包含从原始输入到当前状态的全部信息（可回放）
 *   4. Snapshot 的 schema 变更必须通过 version bump + migration 处理
 *
 * 设计原则：
 *   - 扁平化：不嵌套复杂对象引用
 *   - 自包含：读取 Snapshot 即可完全恢复 Runtime 状态
 *   - 版本化：每个 Snapshot 携带 schemaVersion，支持未来升级
 *
 * @phase decision-runtime
 */

import type { DecisionEventType, DecisionEventPayload } from './decision-event.js'

// ============================================================
// 1. Event Record（持久化到快照中的事件记录）
// ============================================================

export interface EventRecord<E extends DecisionEventType = DecisionEventType> {
  /** 事件 ID（全局唯一） */
  eventId: string

  /** 事件类型 */
  eventType: E

  /** 事件产生时间 */
  timestamp: string // ISO 8601

  /** 事件载荷 */
  payload: DecisionEventPayload[E]

  /** 产生此事件的 Agent 名称 */
  agentName: string

  /** 耗时（毫秒） */
  durationMs?: number
}

// ============================================================
// 2. Decision Snapshot
// ============================================================

export interface DecisionSnapshot {
  /** Snapshot 唯一标识 */
  id: string

  /** Runtime 运行实例 ID（每次 execute 唯一） */
  runtimeId: string

  /** Snapshot schema 版本（对应 Manifest.snapshotVersion） */
  schemaVersion: string

  /** 创建时间 */
  createdAt: string // ISO 8601

  /** 原始用户输入 */
  rawInput: string

  /** 当前 Requirement（已解析后的结构化需求） */
  requirement: {
    domain: string
    city?: string
    budget?: string
    constraints: string[]
    goals: string[]
  } | null

  /** 已搜集的 Evidence */
  evidences: Array<{
    id: string
    source: string
    content: string
    credibility: number // 0-100
    timestamp?: string
  }>

  /** 已识别的 Candidate */
  candidates: Array<{
    id: string
    name: string
    type: string
    evidenceIds: string[]
    scores?: {
      credibility: number
      reputation: number
      serviceQuality: number
      risk: number
      valueForMoney: number
      total: number
    }
  }>

  /** 推荐结果列表（排序后的 candidate ids） */
  recommendation: string[] | null // candidate IDs, ordered

  /** 最终报告 */
  report: string | null

  /** 完整事件日志（用于回放和审计） */
  eventLog: EventRecord[]

  /** 执行状态 */
  status: 'in_progress' | 'completed' | 'failed'

  /** 错误信息（如果有） */
  error?: string
}

// ============================================================
// 3. Snapshot 工厂
// ============================================================

export function createEmptySnapshot(
  runtimeId: string,
  rawInput: string,
  schemaVersion: string = 'v1',
): DecisionSnapshot {
  return {
    id: `snap_${runtimeId}_${Date.now()}`,
    runtimeId,
    schemaVersion,
    createdAt: new Date().toISOString(),
    rawInput,
    requirement: null,
    evidences: [],
    candidates: [],
    recommendation: null,
    report: null,
    eventLog: [],
    status: 'in_progress',
  }
}

// ============================================================
// 4. Snapshot 校验
// ============================================================

export function validateSnapshot(s: DecisionSnapshot): string[] {
  const errors: string[] = []

  if (!s.id) errors.push('snapshot.id 为空')
  if (!s.runtimeId) errors.push('snapshot.runtimeId 为空')
  if (!s.schemaVersion) errors.push('snapshot.schemaVersion 为空')

  // eventLog 中的 eventId 必须唯一
  const eventIds = new Set<string>()
  for (const event of s.eventLog) {
    if (eventIds.has(event.eventId)) {
      errors.push(`重复 eventId: ${event.eventId}`)
    }
    eventIds.add(event.eventId)
  }

  // candidates 中的 evidenceIds 必须都在 evidences 中
  const evidenceIds = new Set(s.evidences.map(e => e.id))
  for (const c of s.candidates) {
    for (const eid of c.evidenceIds) {
      if (!evidenceIds.has(eid)) {
        errors.push(`candidate "${c.id}" 引用了不存在的 evidence "${eid}"`)
      }
    }
  }

  return errors
}
