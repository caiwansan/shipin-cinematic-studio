// ============================================================
// Agent Registry — KMKI-PLAT-010
// 所有 Agent 必须注册到 Registry，禁止代码中硬编码 Agent 名称和逻辑
// 使用 PluginRegistry 作为底层存储
// ============================================================

import type { AgentDefinition } from '../types'
import { PluginRegistry } from '@platform/plugins/plugin-registry'
import type { Plugin } from '@platform/plugins/plugin-registry'
import { NotFoundError } from '@platform/errors/platform-errors'

// ─── Agent Plugin Wrapper ───

export interface AgentPlugin extends Plugin<{ definition: AgentDefinition; execute: (input: any, ctx?: any) => Promise<any> }> {
  name: string     // agent code
  type: 'agent'
  definition: AgentDefinition
  execute(input: any, ctx?: any): Promise<any>
}

// ─── Agent Registry ───

class AgentRegistry {
  private registry = new PluginRegistry<AgentPlugin>()

  /**
   * Register an agent definition.
   * Agents are stored as plugins with type 'agent'.
   */
  register(definition: AgentDefinition, executor?: (input: any, ctx?: any) => Promise<any>): void {
    const plugin: AgentPlugin = {
      name: definition.code,
      type: 'agent',
      definition,
      execute: executor || (async (input: any) => {
        throw new Error(`Agent ${definition.code} has no executor registered`)
      }),
    }
    this.registry.register(plugin)
  }

  /**
   * Unregister an agent by code.
   */
  unregister(code: string): void {
    this.registry.unregister(code)
  }

  /**
   * Find agents that can handle a specific capability.
   * Returns all matching agents sorted by version (newest first).
   */
  findByCapability(capability: string): AgentDefinition[] {
    const agents = this.registry.discover('agent')
    return agents
      .filter(p => p.definition.capabilities.includes(capability))
      .map(p => p.definition)
      .sort((a, b) => b.version.localeCompare(a.version))
  }

  /**
   * Find an agent by its code.
   */
  findByCode(code: string): AgentDefinition | undefined {
    const plugin = this.registry.resolve(code)
    return plugin?.definition
  }

  /**
   * List all registered agents.
   */
  list(): AgentDefinition[] {
    return this.registry.discover('agent').map(p => p.definition)
  }

  /**
   * Get the executor for an agent.
   */
  getExecutor(code: string): ((input: any, ctx?: any) => Promise<any>) | undefined {
    const plugin = this.registry.resolve(code)
    return plugin?.execute
  }

  /**
   * Get version info for an agent.
   */
  getVersion(code: string): string | undefined {
    const def = this.findByCode(code)
    return def?.version
  }

  /**
   * Check if an agent exists.
   */
  has(code: string): boolean {
    return this.registry.has(code)
  }

  /**
   * Get count of registered agents.
   */
  get count(): number {
    return this.registry.count
  }

  /**
   * Clear all agents (for testing).
   */
  clear(): void {
    this.registry.clear()
  }
}

// Singleton
export const agentRegistry = new AgentRegistry()
