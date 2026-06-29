// ============================================================
// Agent Dispatcher — KMKI-PLAT-010
// 禁止 Agent 直接互相依赖，统一通过 Dispatcher 协作
// Dispatcher 负责：查找 Agent → 创建 Session → 调用 Agent.execute() → 记录结果
// ============================================================

import type { AgentContext, AgentResult, DispatchInput, DispatchMultipleInput, DispatchResult } from '../types'
import { agentRegistry } from '../registry/agent-registry'
import { AgentContextFactory } from '../context/agent-context'
import { PlatformError, ExecutionError } from '@platform/errors/platform-errors'
import type { PlatformContext } from '@platform/context/platform-context'
import { getAgentEventBus } from '../events/agent-events'

// ─── Session Store (in-memory, will be DB-backed) ───

interface SessionRecord {
  sessionId: string
  agentCode: string
  status: string
  input: any
  result?: AgentResult
  error?: string
  startedAt: Date
  completedAt?: Date
  metadata?: Record<string, unknown>
}

class Dispatcher {
  private sessions = new Map<string, SessionRecord>()

  /**
   * Dispatch a single agent task.
   * 1. Find agent in registry
   * 2. Create session
   * 3. Build context
   * 4. Execute agent
   * 5. Record results
   */
  async dispatch(
    input: DispatchInput,
    platformCtx?: PlatformContext,
  ): Promise<DispatchResult> {
    const startTime = new Date()
    const definition = agentRegistry.findByCode(input.agentCode)
    if (!definition) {
      throw new NotFoundError(`Agent not found: ${input.agentCode}`)
    }

    const { default: uuid } = await import("uuid")
    const sessionId = uuid()
    const eventBus = getAgentEventBus()

    eventBus.emit({
      type: 'agent:SessionCreated',
      source: 'agent-dispatcher',
      timestamp: startTime.toISOString(),
      payload: { sessionId, agentCode: input.agentCode },
    })

    // Build context
    const ctx = await AgentContextFactory.build(
      sessionId,
      definition,
      platformCtx || {},
      {
        input: input.input,
        variables: input.context?.variables,
        settings: input.context?.settings,
      },
    )

    // Create session record
    const session: SessionRecord = {
      sessionId,
      agentCode: input.agentCode,
      status: 'planning',
      input: input.input,
      startedAt: startTime,
      metadata: input.metadata,
    }
    this.sessions.set(sessionId, session)

    try {
      // Get agent executor
      const executor = agentRegistry.getExecutor(input.agentCode)
      if (!executor) {
        throw new ExecutionError(`No executor registered for agent: ${input.agentCode}`)
      }

      eventBus.emit({
        type: 'agent:Planning',
        source: 'agent-dispatcher',
        timestamp: new Date().toISOString(),
        payload: { sessionId, agentCode: input.agentCode },
      })

      // Execute
      session.status = 'executing'
      const result = await executor(input.input, ctx)

      eventBus.emit({
        type: 'agent:Completed',
        source: 'agent-dispatcher',
        timestamp: new Date().toISOString(),
        payload: { sessionId, agentCode: input.agentCode, success: result.success },
      })

      session.status = result.success ? 'completed' : 'failed'
      session.result = result
      if (!result.success && result.error) {
        session.error = result.error
      }
      session.completedAt = new Date()

      return {
        sessionId,
        agentCode: input.agentCode,
        status: session.status,
        result,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      session.status = 'failed'
      session.error = errorMsg
      session.completedAt = new Date()

      eventBus.emit({
        type: 'agent:Failed',
        source: 'agent-dispatcher',
        timestamp: new Date().toISOString(),
        payload: { sessionId, agentCode: input.agentCode, error: errorMsg },
      })

      return {
        sessionId,
        agentCode: input.agentCode,
        status: 'failed',
        error: errorMsg,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      }
    }
  }

  /**
   * Dispatch multiple agents for collaboration.
   * Supports dependency-based execution (DAG).
   */
  async dispatchMultiple(
    input: DispatchMultipleInput,
    platformCtx?: PlatformContext,
  ): Promise<DispatchResult[]> {
    const results = new Map<string, DispatchResult>()
    const completed = new Set<string>()

    // Process agents in topological order
    const remaining = [...input.agents]

    while (remaining.length > 0) {
      const batch = remaining.filter(agent => {
        if (!agent.dependsOn || agent.dependsOn.length === 0) return true
        return agent.dependsOn.every(dep => completed.has(dep))
      })

      if (batch.length === 0) {
        throw new ExecutionError('Circular dependency detected between agents')
      }

      // Remove batch from remaining
      batch.forEach(a => {
        const idx = remaining.indexOf(a)
        if (idx >= 0) remaining.splice(idx, 1)
      })

      // Execute batch in parallel
      const batchResults = await Promise.all(
        batch.map(async agent => {
          const result = await this.dispatch({
            agentCode: agent.code,
            input: agent.input,
            metadata: input.metadata,
          }, platformCtx)
          results.set(agent.code, result)
          completed.add(agent.code)
          return result
        }),
      )

      // Check if any failed
      for (const r of batchResults) {
        if (r.status === 'failed') {
          // Could implement rollback logic here
          console.warn(`[AgentDispatcher] Agent ${r.agentCode} failed, continuing with remaining`)
        }
      }
    }

    return Array.from(results.values())
  }

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * List all sessions.
   */
  listSessions(filter?: { status?: string; agentCode?: string }): SessionRecord[] {
    let sessions = Array.from(this.sessions.values())
    if (filter?.status) {
      sessions = sessions.filter(s => s.status === filter.status)
    }
    if (filter?.agentCode) {
      sessions = sessions.filter(s => s.agentCode === filter.agentCode)
    }
    return sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  }

  /**
   * Clear sessions for testing.
   */
  clear(): void {
    this.sessions.clear()
  }
}

// ─── Error class ───

export class NotFoundError extends PlatformError {
  constructor(message: string) {
    super('AGENT_NOT_FOUND', message)
    this.statusCode = 404
  }
}

// Singleton
export const agentDispatcher = new Dispatcher()
