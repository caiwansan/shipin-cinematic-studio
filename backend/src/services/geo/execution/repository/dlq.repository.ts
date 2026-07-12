// ============================================================
// IDLQRepository — DLQ Repository 接口定义
// ============================================================

import type { DLQRecord, DLQQuery } from '../dlq/dlq.types'

export interface IDLQRepository {
  save(record: DLQRecord): Promise<void>
  findPending(): Promise<DLQRecord[]>
  findByExecution(executionId: string): Promise<DLQRecord[]>
  findById(id: string): Promise<DLQRecord | null>
  query(query: DLQQuery): Promise<{ records: DLQRecord[]; total: number }>
  markReplayed(id: string, replayedExecutionId: string): Promise<void>
  archive(id: string): Promise<void>
  archiveAllByExecution(executionId: string): Promise<void>
}
