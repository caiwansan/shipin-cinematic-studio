/**
 * execution/journal/index.ts — 执行日志系统（事件溯源）
 *
 * 职责：记录所有 workflow 执行事件，形成不可变日志链。
 *   - 每个执行事件写入 journal
 *   - journal 不可变更改
 *   - 作为 replay 的输入 / debug 的 backbone
 *
 * 当前为 v1 骨架（内存存储），后续可以替换为 DB/事件流。
 *
 * 所属层：Control Plane（日志存储）
 */

export interface JournalEntry {
  /** 唯一事件 ID */
  eventId: string
  /** 关联的 trace ID */
  traceId: string
  /** 事件类型 */
  eventType: 'node_start' | 'node_success' | 'node_failed' | 'workflow_start' | 'workflow_complete' | 'workflow_failed'
  /** 节点 ID（如果适用） */
  nodeId?: string
  /** 节点类型 */
  nodeType?: string
  /** 事件数据 */
  data?: any
  /** 时间戳 */
  timestamp: string
}

class ExecutionJournal {
  private entries: JournalEntry[] = []
  private traceIndex: Map<string, JournalEntry[]> = new Map()

  /** 写入日志条目 */
  append(entry: Omit<JournalEntry, 'eventId' | 'timestamp'>): JournalEntry {
    const full: JournalEntry = {
      ...entry,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
    }
    this.entries.push(full)

    const traceEntries = this.traceIndex.get(entry.traceId) || []
    traceEntries.push(full)
    this.traceIndex.set(entry.traceId, traceEntries)

    return full
  }

  /** 按 traceId 查询日志 */
  getByTraceId(traceId: string): JournalEntry[] {
    return this.traceIndex.get(traceId) || []
  }

  /** 获取所有日志（分页） */
  getAll(limit = 100, offset = 0): JournalEntry[] {
    return this.entries.slice(offset, offset + limit)
  }

  /** 日志数量 */
  get size(): number {
    return this.entries.length
  }
}

let _journal: ExecutionJournal | null = null

export function getExecutionJournal(): ExecutionJournal {
  if (!_journal) _journal = new ExecutionJournal()
  return _journal
}
