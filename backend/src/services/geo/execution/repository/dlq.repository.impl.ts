// ============================================================
// InMemoryDLQRepository — 内存实现
// ============================================================
// 与 RC1 InMemoryExecutionTraceRepository 同样模式使用 Map 存储
// 后续可替换为 Prisma 实现

import type { DLQRecord, DLQQuery } from '../dlq/dlq.types'
import type { IDLQRepository } from './dlq.repository'

export class InMemoryDLQRepository implements IDLQRepository {
  private records: Map<string, DLQRecord> = new Map()

  async save(record: DLQRecord): Promise<void> {
    this.records.set(record.id, { ...record })
  }

  async findPending(): Promise<DLQRecord[]> {
    return Array.from(this.records.values()).filter(r => r.status === 'pending')
  }

  async findByExecution(executionId: string): Promise<DLQRecord[]> {
    return Array.from(this.records.values()).filter(r => r.executionId === executionId)
  }

  async findById(id: string): Promise<DLQRecord | null> {
    const record = this.records.get(id)
    return record ? { ...record } : null
  }

  async query(query: DLQQuery): Promise<{ records: DLQRecord[]; total: number }> {
    let filtered = Array.from(this.records.values())

    if (query.status) {
      filtered = filtered.filter(r => r.status === query.status)
    }
    if (query.executionId) {
      filtered = filtered.filter(r => r.executionId === query.executionId)
    }
    if (query.provider) {
      filtered = filtered.filter(r => r.provider === query.provider)
    }

    const total = filtered.length
    const offset = query.offset ?? 0
    const limit = query.limit ?? 50
    const records = filtered.slice(offset, offset + limit).map(r => ({ ...r }))

    return { records, total }
  }

  async markReplayed(id: string, replayedExecutionId: string): Promise<void> {
    const record = this.records.get(id)
    if (!record) {
      throw new Error(`DLQ record not found: ${id}`)
    }
    record.status = 'replayed'
    record.replayedAt = new Date().toISOString()
    record.replayedExecutionId = replayedExecutionId
    this.records.set(id, { ...record })
  }

  async archive(id: string): Promise<void> {
    const record = this.records.get(id)
    if (!record) {
      throw new Error(`DLQ record not found: ${id}`)
    }
    record.status = 'archived'
    record.archivedAt = new Date().toISOString()
    this.records.set(id, { ...record })
  }

  async archiveAllByExecution(executionId: string): Promise<void> {
    for (const [id, record] of this.records) {
      if (record.executionId === executionId && record.status === 'pending') {
        record.status = 'archived'
        record.archivedAt = new Date().toISOString()
        this.records.set(id, { ...record })
      }
    }
  }
}
