// ─── Sprint-09E-02 Task 03.3 User Confirmation Mechanism ─────
// 待用户确认的字段暂存 + 确认 API
// 零 Schema：确认前驻留在内存 Map，确认后写 CareerProfile

import { CareerExtractionField } from './career-extraction.service.js'

export interface PendingConfirmation {
  id: string
  userId: string
  createdAt: Date
  fields: CareerExtractionField[]
  /** 待确认的 suggest 字段 */
  pendingSuggestions: CareerExtractionField[]
  /** 用户已确认的 fields */
  confirmedFields: string[]
  /** 用户已拒绝的 fields */
  rejectedFields: string[]
  /** AI 原话/上下文 */
  contextMessage?: string
}

/**
 * 内存存储：待用户确认的字段
 *
 * Sprint-09F 可迁移到 DB JSON column（CareerProfile 加 extraction_pending）
 */
class PendingConfirmationStore {
  private store = new Map<string, PendingConfirmation>()

  /**
   * 创建新的确认请求
   */
  create(userId: string, fields: CareerExtractionField[], contextMessage?: string): PendingConfirmation {
    const existing = this.store.get(userId)
    if (existing) {
      // 已有待确认，追加新字段
      existing.pendingSuggestions = this.mergeUnique(
        existing.pendingSuggestions,
        fields.filter(f => f.action === 'suggest')
      )
      existing.fields = this.mergeUnique(existing.fields, fields)
      existing.contextMessage = contextMessage || existing.contextMessage
      return existing
    }

    const entry: PendingConfirmation = {
      id: `pc_${Date.now()}_${userId.slice(0, 8)}`,
      userId,
      createdAt: new Date(),
      fields,
      pendingSuggestions: fields.filter(f => f.action === 'suggest'),
      confirmedFields: fields.filter(f => f.action === 'write').map(f => f.field),
      rejectedFields: [],
      contextMessage,
    }
    this.store.set(userId, entry)
    return entry
  }

  /**
   * 用户确认某个字段
   */
  confirm(userId: string, fieldName: string): PendingConfirmation | null {
    const entry = this.store.get(userId)
    if (!entry) return null

    if (!entry.confirmedFields.includes(fieldName)) {
      entry.confirmedFields.push(fieldName)
    }
    entry.rejectedFields = entry.rejectedFields.filter(f => f !== fieldName)
    entry.pendingSuggestions = entry.pendingSuggestions.filter(f => f.field !== fieldName)

    // 如果全部处理完，可以清理
    if (entry.pendingSuggestions.length === 0) {
      // 不清除，保留供后续参考
    }

    return entry
  }

  /**
   * 用户拒绝某个字段
   */
  reject(userId: string, fieldName: string): PendingConfirmation | null {
    const entry = this.store.get(userId)
    if (!entry) return null

    if (!entry.rejectedFields.includes(fieldName)) {
      entry.rejectedFields.push(fieldName)
    }
    entry.confirmedFields = entry.confirmedFields.filter(f => f !== fieldName)
    entry.pendingSuggestions = entry.pendingSuggestions.filter(f => f.field !== fieldName)

    return entry
  }

  /**
   * 获取用户待确认列表
   */
  get(userId: string): PendingConfirmation | undefined {
    return this.store.get(userId)
  }

  /**
   * 确认后清除（已同步到 CareerProfile）
   */
  clear(userId: string): void {
    this.store.delete(userId)
  }

  private mergeUnique(
    existing: CareerExtractionField[],
    incoming: CareerExtractionField[]
  ): CareerExtractionField[] {
    const existingFields = new Set(existing.map(f => f.field))
    const merged = [...existing]
    for (const f of incoming) {
      if (!existingFields.has(f.field)) {
        merged.push(f)
        existingFields.add(f.field)
      }
    }
    return merged
  }
}

/** 全局单例 */
export const pendingConfirmations = new PendingConfirmationStore()
