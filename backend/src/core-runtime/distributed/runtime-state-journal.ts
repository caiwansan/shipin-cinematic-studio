// ============================================================================
// 盘古斧 AI OS — Phase 8.3: Runtime State Journal (运行时状态日志)
//
// 职责：
//   1. 记录所有运行时状态变更事件（TASK_STARTED/COMPLETED/FAILED,
//      DAG_COMPLETED, SNAPSHOT_CREATED）
//   2. 每个事件附带版本号（Deterministic Version Clock）
//   3. 作为分布式的 "single source of truth" 存储层
//   4. In-memory 环状缓冲区（非持久化），与 stabilized-event-bus 联动
// ============================================================================

import { nextVersion } from './version-clock.js'

export type JournalEventType =
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'DAG_COMPLETED'
  | 'SNAPSHOT_CREATED'
  | 'WORKER_RECOVERED'
  | 'CONSISTENCY_CHECK'

export interface RuntimeStateEvent {
  eventId: string
  tenantId: string
  dagId: string
  type: JournalEventType
  timestamp: number
  payload: unknown
  version: number
}

/** 环状缓冲区 — 最多保存 2000 条 */
const stateJournal: RuntimeStateEvent[] = []
const MAX_JOURNAL_SIZE = 2000

/**
 * 追加一条运行时状态事件到日志
 * 自动生成 eventId（基于 dagId + version）和版本号
 */
export function appendRuntimeEvent(
  tenantId: string,
  dagId: string,
  type: JournalEventType,
  payload: unknown,
): RuntimeStateEvent {
  const version = nextVersion(dagId)
  const event: RuntimeStateEvent = {
    eventId: `${dagId}_v${version}_${Date.now()}`,
    tenantId,
    dagId,
    type,
    timestamp: Date.now(),
    payload,
    version,
  }
  stateJournal.push(event)
  while (stateJournal.length > MAX_JOURNAL_SIZE) stateJournal.shift()
  return event
}

/**
 * 获取指定 dag 的全部日志事件（按 version 升序）
 */
export function getJournal(dagId?: string): RuntimeStateEvent[] {
  if (!dagId) return [...stateJournal]
  return stateJournal
    .filter(e => e.dagId === dagId)
    .sort((a, b) => a.version - b.version)
}

/**
 * 获取日志中最高版本号
 */
export function getMaxVersion(dagId: string): number {
  const events = stateJournal.filter(e => e.dagId === dagId)
  if (events.length === 0) return 0
  return Math.max(...events.map(e => e.version))
}

/**
 * 日志深度
 */
export function getJournalSize(): number {
  return stateJournal.length
}

/**
 * 清空日志
 */
export function clearJournal(): void {
  stateJournal.length = 0
}
