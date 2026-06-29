// ============================================================
// Agent Service — KMKI-PLAT-010
// 业务编排：register, unregister, execute, dispatch, schedule, etc.
// ============================================================

import type {
  AgentDefinition,
  AgentResult,
  DispatchInput,
  DispatchMultipleInput,
  DispatchResult,
  AgentSchedulePlan,
} from './types'
import { agentRegistry } from './registry/agent-registry'
import { agentDispatcher } from './dispatcher/agent-dispatcher'
import { agentScheduler } from './scheduler/agent-scheduler'
import { agentMemoryRuntime } from './memory/agent-memory'
import { toolAdapter } from './tools/tool-adapter'
import { getAgentEventBus } from './events/agent-events'
import type { PlatformContext } from '@platform/context/platform-context'
import type { ToolType, ToolConfig } from './types'

export class AgentService {
  // ─── Agent Definition Management ───

  async register(
    definition: Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>,
    executor?: (input: any, ctx?: any) => Promise<any>,
  ): Promise<AgentDefinition> {
    const uuidModule = await import('uuid')
    console.log('[AgentService] uuid module keys:', Object.keys(uuidModule))
    const uuid = uuidModule.default
    console.log('[AgentService] uuid type:', typeof uuid)
    const fullDef: AgentDefinition = {
      id: uuid(),
      ...definition,
      status: definition.status || 'active',
      schemaVersion: definition.schemaVersion || 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    agentRegistry.register(fullDef, executor)

    getAgentEventBus().emit({
      type: 'agent:Registered',
      source: 'agent-service',
      timestamp: new Date().toISOString(),
      payload: { agentCode: fullDef.code, agentId: fullDef.id },
    })

    return fullDef
  }

  async unregister(code: string): Promise<boolean> {
    const exists = agentRegistry.has(code)
    if (!exists) return false

    agentRegistry.unregister(code)

    getAgentEventBus().emit({
      type: 'agent:Unregistered',
      source: 'agent-service',
      timestamp: new Date().toISOString(),
      payload: { agentCode: code },
    })

    return true
  }

  // ─── Execution ───

  async execute(
    agentCode: string,
    input: any,
    platformCtx?: PlatformContext,
  ): Promise<DispatchResult> {
    return agentDispatcher.dispatch({ agentCode, input }, platformCtx)
  }

  async dispatch(
    input: DispatchInput,
    platformCtx?: PlatformContext,
  ): Promise<DispatchResult> {
    return agentDispatcher.dispatch(input, platformCtx)
  }

  async dispatchMultiple(
    input: DispatchMultipleInput,
    platformCtx?: PlatformContext,
  ): Promise<DispatchResult[]> {
    return agentDispatcher.dispatchMultiple(input, platformCtx)
  }

  async schedule(
    plan: AgentSchedulePlan,
    platformCtx?: PlatformContext,
  ): Promise<any> {
    return agentScheduler.schedule(plan, platformCtx)
  }

  // ─── Session Management ───

  getSession(sessionId: string): any {
    return agentDispatcher.getSession(sessionId)
  }

  listSessions(filter?: { status?: string; agentCode?: string }): any[] {
    return agentDispatcher.listSessions(filter)
  }

  // ─── Schedule Management ───

  async cancelSchedule(jobId: string): Promise<boolean> {
    return agentScheduler.cancel(jobId)
  }

  getSchedule(jobId: string): any {
    return agentScheduler.getJob(jobId)
  }

  listSchedules(filter?: { status?: string }): any[] {
    return agentScheduler.listJobs(filter)
  }

  // ─── Memory ───

  async storeMemory(
    sessionId: string,
    type: string,
    content: any,
    relevanceScore?: number,
    ttl?: number,
  ): Promise<void> {
    await agentMemoryRuntime.store(sessionId, type, content, relevanceScore, ttl)
  }

  async retrieveMemory(sessionId: string, type?: string): Promise<any[]> {
    return agentMemoryRuntime.retrieve(sessionId, type)
  }

  async summarizeMemory(sessionId: string): Promise<string> {
    return agentMemoryRuntime.summarize(sessionId)
  }

  // ─── Tools ───

  async invokeTool(
    type: ToolType,
    name: string,
    params: Record<string, unknown>,
    ctx?: any,
  ): Promise<any> {
    return toolAdapter.invoke(type, name, params, ctx)
  }

  async installTool(type: ToolType, config: ToolConfig): Promise<void> {
    return toolAdapter.install(type, config)
  }

  listTools(): ToolType[] {
    return toolAdapter.listAvailable()
  }

  getToolStatus(type: ToolType): string {
    return toolAdapter.getStatus(type)
  }

  // ─── Query ───

  listAgents(): AgentDefinition[] {
    return agentRegistry.list()
  }

  getAgent(code: string): AgentDefinition | undefined {
    return agentRegistry.findByCode(code)
  }

  findAgentsByCapability(capability: string): AgentDefinition[] {
    return agentRegistry.findByCapability(capability)
  }

  // ─── Health ───

  health(): Record<string, any> {
    return {
      status: 'ok',
      registeredAgents: agentRegistry.count,
      activeSessions: agentDispatcher.listSessions({ status: 'executing' }).length,
      availableTools: toolAdapter.listAvailable(),
      memoryStats: {
        // memory stats could be added
      },
      uptime: process.uptime(),
    }
  }
}

// Singleton
export const agentService = new AgentService()
