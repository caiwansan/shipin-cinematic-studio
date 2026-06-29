// ============================================================
// Agent Memory Runtime — KMKI-PLAT-010
// 会话记忆管理：shortTerm, workspace, knowledge, summary
// 支持持久化、检索、摘要、过期清理
// ============================================================

import type { AgentMemory } from '../types'

interface MemoryRecord {
  id: string
  sessionId: string
  type: string
  content: Record<string, unknown>
  relevanceScore?: number
  ttl?: number
  metadata?: Record<string, unknown>
  createdAt: Date
  expiresAt?: Date
}

class AgentMemoryRuntime {
  private memories = new Map<string, MemoryRecord[]>()  // sessionId -> memories
  private cleanupTimer?: ReturnType<typeof setInterval>

  constructor() {
    // Auto cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.expire()
    }, 5 * 60 * 1000)
  }

  /**
   * Store a memory for a session.
   */
  async store(
    sessionId: string,
    type: string,
    content: any,
    relevanceScore?: number,
    ttl?: number,
  ): Promise<MemoryRecord> {
    const { default: uuid } = await import("uuid")

    const record: MemoryRecord = {
      id: uuid(),
      sessionId,
      type,
      content: typeof content === 'string' ? { text: content } : content,
      relevanceScore,
      ttl,
      createdAt: new Date(),
      expiresAt: ttl ? new Date(Date.now() + ttl * 1000) : undefined,
    }

    if (!this.memories.has(sessionId)) {
      this.memories.set(sessionId, [])
    }
    this.memories.get(sessionId)!.push(record)

    return record
  }

  /**
   * Retrieve memories for a session by type.
   */
  async retrieve(sessionId: string, type?: string): Promise<AgentMemory[]> {
    const records = this.memories.get(sessionId) || []
    const now = new Date()

    const filtered = records.filter(r => {
      // Filter out expired
      if (r.expiresAt && r.expiresAt < now) return false
      // Filter by type if specified
      if (type && r.type !== type) return false
      return true
    })

    // Sort by relevance score (highest first), then by creation time
    return filtered
      .sort((a, b) => {
        const scoreA = a.relevanceScore || 0
        const scoreB = b.relevanceScore || 0
        if (scoreB !== scoreA) return scoreB - scoreA
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      .map(r => ({
        id: r.id,
        sessionId: r.sessionId,
        type: r.type as AgentMemory['type'],
        content: r.content,
        relevanceScore: r.relevanceScore,
        ttl: r.ttl,
        metadata: r.metadata,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      }))
  }

  /**
   * Summarize all memories for a session.
   * Returns a concatenated summary of relevant context.
   */
  async summarize(sessionId: string): Promise<string> {
    const memories = await this.retrieve(sessionId)
    if (memories.length === 0) return ''

    const summary = memories.map(m => {
      const content = typeof m.content === 'object'
        ? JSON.stringify(m.content, null, 2)
        : String(m.content)
      return `[${m.type}] ${content}`
    })

    return summary.join('\n---\n')
  }

  /**
   * Clear memory for a session.
   */
  async clearSession(sessionId: string): Promise<void> {
    this.memories.delete(sessionId)
  }

  /**
   * Remove expired memories.
   */
  async expire(): Promise<number> {
    const now = new Date()
    let expiredCount = 0

    for (const [sessionId, records] of this.memories.entries()) {
      const valid = records.filter(r => {
        if (r.expiresAt && r.expiresAt < now) {
          expiredCount++
          return false
        }
        return true
      })

      if (valid.length === 0) {
        this.memories.delete(sessionId)
      } else {
        this.memories.set(sessionId, valid)
      }
    }

    return expiredCount
  }

  /**
   * Dispose the runtime (cleanup timer).
   */
  async dispose(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }
}

// Singleton
export const agentMemoryRuntime = new AgentMemoryRuntime()
