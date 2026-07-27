/**
 * Kunlun Knowledge Hub — Phase 3-D: Memory Engine
 * 
 * 记忆引擎：Working Memory / Short Memory / Long Memory
 * 
 * Working Memory: 当前对话上下文（会话内有效）
 * Short Memory:   最近7天的记忆（跨会话，短期有效）
 * Long Memory:    长期稳定偏好和事实（永久有效）
 */

import type { MemoryCanonicalObject } from '../canonical/schemas'
import type { IMemoryEngine } from '../registry/tool-registry'

// ─── Memory Engine 实现 ───

export class MemoryEngine implements IMemoryEngine {
  // 内存存储（后续替换为 Redis + PostgreSQL）
  private store: Map<string, MemoryCanonicalObject[]> = new Map()

  /**
   * 记住：存储一条记忆
   */
  async remember(
    userId: string,
    memory: Omit<MemoryCanonicalObject, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MemoryCanonicalObject> {
    const now = new Date().toISOString()
    const newMemory: MemoryCanonicalObject = {
      ...memory,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }

    const existing = this.store.get(userId) || []
    existing.push(newMemory)
    this.store.set(userId, existing)

    return newMemory
  }

  /**
   * 召回：基于查询检索相关记忆
   * 简化实现：关键词匹配（未来升级为向量检索）
   */
  async recall(
    userId: string,
    query: string,
    options?: { layer?: string; topK?: number }
  ): Promise<MemoryCanonicalObject[]> {
    const memories = this.store.get(userId) || []
    const layer = options?.layer || 'all'
    const topK = options?.topK || 5

    let filtered = memories

    // 按层级过滤
    if (layer !== 'all') {
      filtered = filtered.filter(m => m.layer === layer)
    }

    // 按时间过滤（过期记忆不召回）
    const now = Date.now()
    filtered = filtered.filter(m => {
      if (!m.expirationDate) return true
      return new Date(m.expirationDate).getTime() > now
    })

    // 简化关键词匹配（未来升级为 embedding 相似度）
    const keywords = query.toLowerCase().split(/\s+/)
    const scored = filtered.map(m => {
      const content = m.content.toLowerCase()
      let score = 0
      for (const kw of keywords) {
        if (content.includes(kw)) score += 1
      }
      // 考虑置信度和时效性
      const daysOld = (now - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      const recencyBoost = Math.max(0, 1 - daysOld / 30)  // 30天内衰减
      const finalScore = (score * m.confidence * (1 + recencyBoost)) / (keywords.length || 1)
      return { memory: m, score: finalScore }
    })

    // 按分数排序
    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, topK).map(s => s.memory)
  }

  /**
   * 遗忘：删除一条记忆
   */
  async forget(memoryId: string): Promise<boolean> {
    for (const [userId, memories] of Array.from(this.store.entries())) {
      const idx = memories.findIndex(m => m.id === memoryId)
      if (idx >= 0) {
        memories.splice(idx, 1)
        return true
      }
    }
    return false
  }

  /**
   * 巩固：将短期记忆转为长期记忆
   * 触发条件：同一信息被多次确认 / 用户明确说"记住这个"
   */
  async consolidate(userId: string): Promise<number> {
    const memories = this.store.get(userId) || []
    let consolidated = 0

    // 找出 Short Memory 中高频出现的主题
    const shortMemories = memories.filter(m => m.layer === 'short')
    const contentCount = new Map<string, number>()

    for (const m of shortMemories) {
      const key = m.content.slice(0, 50)  // 简化：按前缀分组
      contentCount.set(key, (contentCount.get(key) || 0) + 1)
    }

    // 出现 >= 2 次的转为 Long Memory
    for (const m of shortMemories) {
      const key = m.content.slice(0, 50)
      if ((contentCount.get(key) || 0) >= 2) {
        m.layer = 'long'
        m.updatedAt = new Date().toISOString()
        consolidated++
      }
    }

    return consolidated
  }

  /**
   * 获取 Working Memory（当前会话上下文）
   */
  async getWorkingMemory(userId: string): Promise<MemoryCanonicalObject[]> {
    const memories = this.store.get(userId) || []
    // Working Memory 是最近创建的、未过期的
    const now = Date.now()
    return memories
      .filter(m => {
        if (m.layer !== 'working') return false
        if (!m.expirationDate) return true
        return new Date(m.expirationDate).getTime() > now
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)  // 最多10条工作记忆
  }

  /**
   * 清理过期记忆（定时任务调用）
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [userId, memories] of Array.from(this.store.entries())) {
      const valid = memories.filter(m => {
        if (!m.expirationDate) return true
        return new Date(m.expirationDate).getTime() > now
      })
      cleaned += memories.length - valid.length
      this.store.set(userId, valid)
    }

    return cleaned
  }
}

function generateId(): string {
  return `mco_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
