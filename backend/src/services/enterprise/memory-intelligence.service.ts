/**
 * Memory Intelligence Service — ER-03
 * Enterprise Memory Classification + Governance
 *
 * 定位: 企业知识与 Agent 记忆关系的管理层
 * 复用: AgentMemory, AgentContextMemory, MemoryNamespaceService
 *
 * 三大引擎:
 *   1. MemoryClassifier  — 5 类记忆自动分类
 *   2. MemoryGovernance  — Role-Based 记忆权限
 *   3. MemoryOutcomeBridge — Outcome → Experience → Memory
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export type MemoryCategory = 'shortTerm' | 'session' | 'task' | 'business' | 'longTerm'

export interface MemoryClassification {
  category: MemoryCategory
  ttl?: number  // seconds, for shortTerm
  memoryType: string
  storage: 'context' | 'persistent'
  reason: string
}

export interface MemoryGovernanceRule {
  id: string
  organizationId: string
  agentId?: string
  agentRole?: string
  allowedTypes: string[]
  deniedTypes: string[]
  maxRetentionDays: number
  createdAt: Date
}

export interface MemoryRecord {
  id: string
  organizationId: string
  agentId: string
  category: MemoryCategory
  type: string
  content: string
  source: string  // outcome, execution, command, external
  createdAt: Date
  expiresAt?: Date
}

// ─── Service ─────────────────────────────────────────────

export class MemoryIntelligenceService {

  // ─── 1. Memory Classification ──────────────────────────

  /**
   * 自动分类记忆
   */
  classify(content: string, context: {
    source: 'outcome' | 'execution' | 'command' | 'external'
    agentId: string
    organizationId: string
    sessionId?: string
    taskId?: string
  }): MemoryClassification {
    const { source, taskId, sessionId } = context

    // 规则 1: Outcome → Business Memory (永久)
    if (source === 'outcome') {
      return {
        category: 'business',
        memoryType: 'business',
        storage: 'persistent',
        reason: 'Outcome contains business knowledge',
      }
    }

    // 规则 2: Task Execution → Task Memory (任务周期)
    if (source === 'execution' && taskId) {
      return {
        category: 'task',
        memoryType: 'task',
        storage: 'persistent',
        reason: 'Task execution experience',
      }
    }

    // 规则 3: Session Command → Session Memory (会话)
    if (source === 'command' && sessionId) {
      return {
        category: 'session',
        memoryType: 'summary',
        storage: 'context',
        reason: 'Session command context',
      }
    }

    // 规则 4: Short-lived context → Short Term (临时)
    if (sessionId && !taskId) {
      return {
        category: 'shortTerm',
        ttl: 3600, // 1 hour
        memoryType: 'shortTerm',
        storage: 'context',
        reason: 'Short-term session context',
      }
    }

    // 规则 5: External events → Long Term (永久)
    if (source === 'external') {
      return {
        category: 'longTerm',
        memoryType: 'longterm',
        storage: 'persistent',
        reason: 'External event for long-term reference',
      }
    }

    // Default: Task-level persistent
    return {
      category: 'task',
      memoryType: 'task',
      storage: 'persistent',
      reason: 'Default classification',
    }
  }

  /**
   * 存储分类后的记忆
   */
  async storeMemory(
    organizationId: string,
    agentId: string,
    content: string,
    context: {
      source: 'outcome' | 'execution' | 'command' | 'external'
      sessionId?: string
      taskId?: string
      type?: string
    },
  ): Promise<MemoryRecord> {
    // 1. 分类
    const classification = this.classify(content, {
      ...context,
      agentId,
      organizationId,
    })

    // 2. 治理校验
    const governanceResult = this.checkGovernance(organizationId, agentId, classification.memoryType)
    if (!governanceResult.allowed) {
      throw new Error(`MEMORY_GOVERNANCE_DENIED: ${governanceResult.reason}`)
    }

    // 3. 存储
    const now = new Date()
    let expiresAt: Date | undefined

    if (classification.storage === 'context') {
      // 存入 AgentContextMemory
      const ttl = classification.ttl || 3600
      expiresAt = new Date(now.getTime() + ttl * 1000)

      await prisma.agentContextMemory.create({
        data: {
          sessionId: context.sessionId || `mem-${Date.now()}`,
          type: classification.memoryType,
          content,
          ttl,
          expiresAt,
          relevanceScore: 1.0,
          metadata: JSON.stringify({
            organizationId,
            agentId,
            source: context.source,
            category: classification.category,
          }),
        },
      })
    } else {
      // 存入 AgentMemory
      await prisma.agentMemory.create({
        data: {
          agentId,
          memoryType: classification.memoryType,
          content,
          embeddingVector: null,
        },
      })
    }

    return {
      id: `${Date.now()}`,
      organizationId,
      agentId,
      category: classification.category,
      type: classification.memoryType,
      content,
      source: context.source,
      createdAt: now,
      expiresAt,
    }
  }

  // ─── 2. Memory Governance ──────────────────────────────

  /**
   * 创建治理规则
   */
  async createGovernanceRule(rule: {
    organizationId: string
    agentId?: string
    agentRole?: string
    allowedTypes: string[]
    deniedTypes: string[]
    maxRetentionDays?: number
  }): Promise<MemoryGovernanceRule> {
    const now = new Date()
    const governanceRule: MemoryGovernanceRule = {
      id: `${Date.now()}`,
      organizationId: rule.organizationId,
      agentId: rule.agentId,
      agentRole: rule.agentRole,
      allowedTypes: rule.allowedTypes,
      deniedTypes: rule.deniedTypes,
      maxRetentionDays: rule.maxRetentionDays || 90,
      createdAt: now,
    }

    // 存储到 AgentMemory (business type = governance rule)
    await prisma.agentMemory.create({
      data: {
        agentId: 'agent_camera',
        memoryType: 'governance_rule',
        content: JSON.stringify(governanceRule),
        embeddingVector: null,
      },
    })

    return governanceRule
  }

  /**
   * 检查记忆访问权限
   */
  checkGovernance(organizationId: string, agentId: string, memoryType: string): {
    allowed: boolean
    reason?: string
  } {
    // 简化版: 基于 Role 的默认规则
    // 完整实现需要查询治理规则

    // 默认允许所有
    return { allowed: true }
  }

  /**
   * 获取治理规则
   */
  async getGovernanceRules(organizationId: string): Promise<MemoryGovernanceRule[]> {
    // 从 AgentMemory 读取治理规则
    const memories = await prisma.agentMemory.findMany({
      where: {
        agentId: 'agent_camera',
        memoryType: 'governance_rule',
      },
      orderBy: { createdAt: 'desc' },
    })

    return memories
      .map(m => {
        try {
          const rule = JSON.parse(m.content)
          return rule.organizationId === organizationId ? rule : null
        } catch { return null }
      })
      .filter(Boolean) as MemoryGovernanceRule[]
  }

  // ─── 3. Memory-Outcome Bridge ──────────────────────────
  // NOTE: outcomeRecord model removed — bridge disabled
  // TODO: reimplement via Outcome V2 when available
  async bridgeOutcomeToMemory(_organizationId: string, _agentId: string, _outcomeId: string): Promise<MemoryRecord | null> {
    return null // Disabled — outcomeRecord table does not exist
  }

  // ─── 4. Memory Query ───────────────────────────────────

  /**
   * 查询 Agent 记忆
   */
  async queryMemories(organizationId: string, agentId: string, options?: {
    category?: MemoryCategory
    type?: string
    limit?: number
  }): Promise<MemoryRecord[]> {
    const memories: MemoryRecord[] = []

    // 查询 AgentMemory (持久)
    const persistentMemories = await prisma.agentMemory.findMany({
      where: { agentId },
      take: options?.limit || 50,
      orderBy: { createdAt: 'desc' },
    })

    for (const mem of persistentMemories) {
      memories.push({
        id: mem.id,
        organizationId,
        agentId,
        category: mem.memoryType as MemoryCategory,
        type: mem.memoryType,
        content: mem.content,
        source: 'execution',
        createdAt: mem.createdAt,
      })
    }

    // 查询 AgentContextMemory (上下文)
    const contextMemories = await prisma.agentContextMemory.findMany({
      where: {
        metadata: { contains: organizationId },
      },
      take: options?.limit || 20,
      orderBy: { createdAt: 'desc' },
    })

    for (const mem of contextMemories) {
      memories.push({
        id: mem.id,
        organizationId,
        agentId,
        category: mem.type as MemoryCategory,
        type: mem.type,
        content: mem.content,
        source: 'command',
        createdAt: mem.createdAt,
        expiresAt: mem.expiresAt || undefined,
      })
    }

    return memories
  }

  /**
   * 获取记忆统计
   */
  async getMemoryStats(organizationId: string, agentId: string): Promise<{
    total: number
    byCategory: Record<string, number>
    oldest: Date | null
    newest: Date | null
  }> {
    const memories = await this.queryMemories(organizationId, agentId)

    const byCategory: Record<string, number> = {}
    let oldest: Date | null = null
    let newest: Date | null = null

    for (const mem of memories) {
      byCategory[mem.category] = (byCategory[mem.category] || 0) + 1
      if (!oldest || mem.createdAt < oldest) oldest = mem.createdAt
      if (!newest || mem.createdAt > newest) newest = mem.createdAt
    }

    return {
      total: memories.length,
      byCategory,
      oldest,
      newest,
    }
  }
}

export const memoryIntelligenceService = new MemoryIntelligenceService()
