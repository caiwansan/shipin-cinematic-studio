// ============================================================
// Frontend Agent Provider — KMKI-PLAT-010
// Provider 层封装 API 调用
// ============================================================

import { agentService } from './agent.service'
import type { AgentDefinition, AgentSession, DispatchResult, AgentMemoryItem, AgentSchedulePlan } from '../types/index'

export class AgentProvider {
  async registerAgent(definition: Partial<AgentDefinition>): Promise<AgentDefinition> {
    return agentService.registerAgent(definition)
  }

  async unregisterAgent(code: string): Promise<void> {
    return agentService.unregisterAgent(code)
  }

  async executeAgent(code: string, input: any): Promise<DispatchResult> {
    return agentService.executeAgent(code, input)
  }

  async dispatchAgents(code: string, input: any): Promise<DispatchResult> {
    return agentService.dispatch(code, input)
  }

  async scheduleAgents(plan: AgentSchedulePlan): Promise<any> {
    return agentService.schedule(plan)
  }

  async getSession(id: string): Promise<AgentSession> {
    return agentService.getSession(id)
  }

  async getSessionHistory(filter?: { status?: string; agentCode?: string }): Promise<AgentSession[]> {
    return agentService.listSessions(filter)
  }

  async getMemory(sessionId: string, type?: string): Promise<AgentMemoryItem[]> {
    return agentService.retrieveMemory(sessionId, type)
  }

  async summarizeMemory(sessionId: string): Promise<string> {
    return agentService.summarizeMemory(sessionId)
  }
}

export const agentProvider = new AgentProvider()
