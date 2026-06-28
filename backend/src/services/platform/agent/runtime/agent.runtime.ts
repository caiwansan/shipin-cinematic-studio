// ============================================================
// Agent Runtime — KMKI-PLAT-010
// 遵循 ARCH-002 冻结规范：Init/Load/Validate/Execute/Update/Dispose
// 使用 PlatformContext, EventBus, PlatformError
// ============================================================

import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle'
import type { PlatformContext } from '@platform/context/platform-context'
import { RuntimeError } from '@platform/errors/platform-errors'
import { agentService } from '../agent.service'

export class AgentRuntime implements RuntimeLifecycle<any, any> {
  private initialized = false
  private loadedAgents: string[] = []

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return

    console.log('[AgentRuntime] Initializing...')

    // Could auto-discover and register built-in agents here
    this.initialized = true

    console.log('[AgentRuntime] Initialized')
  }

  async load(ctx: PlatformContext, id: string): Promise<any> {
    // If id is an agent code, load its definition
    const agent = agentService.getAgent(id)
    if (!agent) {
      throw new RuntimeError(`Agent not found: ${id}`, { agentCode: id })
    }

    this.loadedAgents.push(id)

    return {
      definition: agent,
      sessionHistory: agentService.listSessions({ agentCode: id }).slice(0, 10),
    }
  }

  async validate(ctx: PlatformContext, input: any): Promise<boolean> {
    if (!input) return false
    if (!input.agentCode && !input.capability) return false
    return true
  }

  async execute(ctx: PlatformContext, input: any): Promise<any> {
    if (!this.initialized) {
      throw new RuntimeError('AgentRuntime not initialized')
    }

    const { agentCode, ...rest } = input || {}

    if (agentCode) {
      return agentService.execute(agentCode, rest, ctx)
    }

    if (input.capability) {
      const agents = agentService.findAgentsByCapability(input.capability)
      if (agents.length === 0) {
        throw new RuntimeError(`No agent found for capability: ${input.capability}`)
      }
      return agentService.execute(agents[0].code, input, ctx)
    }

    throw new RuntimeError('Invalid input: must specify agentCode or capability')
  }

  async update(ctx: PlatformContext, id: string, data: Partial<any>): Promise<any> {
    // Agents are immutable once registered; updates require re-registration
    throw new RuntimeError('Agent update not supported. Use register() to replace.')
  }

  async dispose(ctx: PlatformContext): Promise<void> {
    this.initialized = false
    this.loadedAgents = []
    console.log('[AgentRuntime] Disposed')
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// Singleton
export const agentRuntime = new AgentRuntime()
