// ============================================================
// Agent Context Factory — KMKI-PLAT-010
// 根据 sessionId 构建完整 AgentContext
// Agent 不直接访问数据库，通过 AgentContext 读取一切需要的信息
// ============================================================

import type { AgentContext, AgentDefinition, AgentMemory as AgentMemoryType } from '../types'
import type { PlatformContext } from '@platform/context/platform-context'
import { agentMemoryRuntime } from '../memory/agent-memory'

// ─── Logger ───

function createLogger(agentCode: string) {
  return {
    info: (msg: string, data?: any) => console.log(`[Agent:${agentCode}] INFO: ${msg}`, data ? JSON.stringify(data).slice(0, 200) : ''),
    warn: (msg: string, data?: any) => console.warn(`[Agent:${agentCode}] WARN: ${msg}`, data ? JSON.stringify(data).slice(0, 200) : ''),
    error: (msg: string, data?: any) => console.error(`[Agent:${agentCode}] ERROR: ${msg}`, data ? JSON.stringify(data).slice(0, 200) : ''),
    debug: (msg: string, data?: any) => {
      if (process.env.DEBUG) {
        console.debug(`[Agent:${agentCode}] DEBUG: ${msg}`, data ? JSON.stringify(data).slice(0, 200) : '')
      }
    },
  }
}

// ─── Agent Context Factory ───

export class AgentContextFactory {
  /**
   * Build a complete AgentContext for an agent session.
   */
  static async build(
    sessionId: string,
    agentDefinition: AgentDefinition,
    platformContext: PlatformContext,
    overrides?: {
      input?: Record<string, unknown>
      variables?: Record<string, any>
      settings?: Record<string, any>
    },
  ): Promise<AgentContext> {
    const logger = createLogger(agentDefinition.code)

    const ctx: AgentContext = {
      sessionId,
      workspace: {
        id: platformContext.workspaceId || 'unknown',
        type: 'short_drama',
        name: '',
        settings: {},
        metadata: {},
      },
      capabilityResolver: {
        resolve: async (capabilityName: string, input: any) => {
          try {
            const { capabilityRuntime } = await import('../../capability/runtime/capability.runtime.js')
            return capabilityRuntime.resolve({
              capabilityName,
              input,
              context: {
                userId: platformContext.userId,
                projectId: platformContext.projectId,
              },
            })
          } catch (err) {
            logger.error(`Capability resolution failed: ${capabilityName}`, err)
            throw err
          }
        },
        list: async (filter?) => {
          try {
            const { capabilityRuntime } = await import('../../capability/runtime/capability.runtime.js')
            return capabilityRuntime.listCapabilities() as any
          } catch {
            return []
          }
        },
      },
      resourceResolver: {
        resolve: async (resourceType: string, config?: Record<string, unknown>) => {
          try {
            const { resourceResolver } = await import('../../resource/resolver/resource-resolver.js')
            return resourceResolver.resolve({
              capabilityName: resourceType,
              strategy: 'balanced',
              tenantId: platformContext?.tenantId || 'default',
              options: config as any,
            })
          } catch {
            logger.warn(`Resource resolver not available for: ${resourceType}`)
            return null
          }
        },
      },
      memory: {
        store: async (type: string, content: any, relevanceScore?: number, ttl?: number) => {
          await agentMemoryRuntime.store(sessionId, type, content, relevanceScore, ttl)
        },
        retrieve: async (type: string): Promise<AgentMemoryType[]> => {
          return agentMemoryRuntime.retrieve(sessionId, type)
        },
        summarize: async (): Promise<string> => {
          return agentMemoryRuntime.summarize(sessionId)
        },
      },
      variables: overrides?.variables || {},
      settings: overrides?.settings || {},
      agentDefinition,
      platformContext,
      logger,
    }

    // Try to load workspace info
    if (platformContext.workspaceId) {
      try {
        const { workspaceService } = await import('../../workspace/workspace.service.js')
        const ws = await workspaceService.get(platformContext.workspaceId)
        if (ws) {
          ctx.workspace = {
            id: ws.id,
            type: ws.type,
            name: ws.name,
            settings: ws.settings,
            metadata: ws.metadata,
          }
        }
      } catch {
        logger.warn('Could not load workspace info')
      }
    }

    // Set up conversation if not provided
    ctx.conversation = {
      messages: [],
      addMessage: async (role: string, content: string) => {
        ctx.conversation!.messages.push({ role, content, timestamp: new Date() })
        // Could persist to DB in future
      },
    }

    return ctx
  }
}
