/**
 * kernel-v1/event-log.ts — EventLog Store (v1.1: Causal Layer)
 *
 * 职责：append-only 事件记录器
 * 定位：EventLog = SYSTEM TRUTH（EntityGraph/Timeline/Snapshot 都可重建）
 * v1.1 升级：EventRecord 新增 causal binding 字段，支持因果链追踪
 */

import crypto from 'crypto'
import { KernelCommand, EventRecord, KernelSource } from './types.js'
import { prisma } from '../utils/index.js'

export interface CausalMeta {
  parentEventId?: string
  triggeredBy: string
  affectedEntityIds?: string[]
  affectedTimelineIds?: string[]
}

export class EventLogStore {
  /** v1 先用内存 store，后续切到 event_log 表 */
  private memoryStore: Map<string, EventRecord[]> = new Map()  // projectId → events
  private sequences: Map<string, number> = new Map()           // projectId → next seq

  /**
   * 追加事件记录（先写内存，后续写 DB）
   * v1.1: 支持 causal 元数据注入
   */
  async append(cmd: KernelCommand, causal?: CausalMeta): Promise<EventRecord> {
    const projectId = cmd.payload.projectId
    const seq = (this.sequences.get(projectId) ?? 0) + 1
    this.sequences.set(projectId, seq)

    const record: EventRecord = {
      id: crypto.randomUUID(),
      projectId,
      timestamp: Date.now(),
      source: cmd.source,
      type: cmd.type,
      target: cmd.target,
      payload: cmd.payload,
      sequence: seq,
      // v1.1: causal binding
      ...(causal ? {
        causal: {
          parentEventId: causal.parentEventId,
          triggeredBy: causal.triggeredBy,
          affectedEntityIds: causal.affectedEntityIds ?? [],
          affectedTimelineIds: causal.affectedTimelineIds ?? [],
        }
      } : {}),
    }

    // v1.3: immutable enforcement（防止 append 后被篡改）
    Object.freeze(record)

    // 写内存
    if (!this.memoryStore.has(projectId)) {
      this.memoryStore.set(projectId, [])
    }
    this.memoryStore.get(projectId)!.push(record)

    // 写 DB（异步，不阻塞）
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO event_log (id, project_id, timestamp, source, type, target, payload, sequence)
         VALUES ($1, $2, to_timestamp($3::double precision / 1000), $4, $5, $6, $7::jsonb, $8)
         ON CONFLICT DO NOTHING`,
        record.id,
        projectId,
        record.timestamp,
        record.source,
        record.type,
        record.target,
        JSON.stringify(record.payload),
        record.sequence
      )
    } catch (err) {
      console.warn('[EventLog] DB write failed (non-fatal):', (err as Error).message)
    }

    return record
  }

  /**
   * v1.2: 获取指定项目的所有事件（内存版）
   * 用于因果约束校验
   */
  getByProject(projectId: string): Array<{ id: string; projectId: string; source: string; type: string; payload: any; sequence: number }> {
    return this.memoryStore.get(projectId) ?? []
  }

  /**
   * 回放指定项目的所有事件（按 sequence 排序）
   * 这是 Kernel 是否成立的唯一验证标准
   */
  async replay(projectId: string): Promise<EventRecord[]> {
    // 先从 DB 读
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM event_log WHERE project_id = $1 ORDER BY sequence ASC`,
        projectId
      )
      if (rows.length > 0) {
        return rows.map(r => ({
          id: r.id,
          projectId: r.project_id,
          timestamp: new Date(r.timestamp).getTime(),
          source: r.source as EventRecord['source'],
          type: r.type as EventRecord['type'],
          target: r.target as EventRecord['target'],
          payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
          sequence: r.sequence,
        }))
      }
    } catch {
      // DB 还没表，fallback 到内存
    }

    // fallback：内存 store
    return this.memoryStore.get(projectId) ?? []
  }

  /**
   * v1.1: 获取到指定 eventId 为止的所有事件
   * 用于 reconstruction replay
   */
  async getAllUntil(projectId: string, eventId: string): Promise<EventRecord[]> {
    const all = await this.replay(projectId)
    const idx = all.findIndex(e => e.id === eventId)
    if (idx === -1) return all
    return all.slice(0, idx + 1)
  }

  /**
   * 清空指定项目的 event log（测试用）
   */
  clear(projectId: string): void {
    this.memoryStore.delete(projectId)
    this.sequences.delete(projectId)
  }
}
