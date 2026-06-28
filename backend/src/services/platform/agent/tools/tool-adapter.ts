// ============================================================
// Tool Adapter — KMKI-PLAT-010
// 统一工具调用接口：Agent 只调用 tool.invoke()
// 预留 MCP、Browser、Search、Python、Database、HTTP、Filesystem、Custom
// ============================================================

import type { ToolAdapter, ToolType, ToolConfig, ToolResult, ToolStatus, AgentContext } from '../types'
import { PlatformError } from '@platform/errors/platform-errors'

// ─── Stub Tool Implementations ───

interface ToolHandler {
  type: ToolType
  name: string
  invoke(params: Record<string, unknown>, ctx?: AgentContext): Promise<ToolResult>
  status: ToolStatus
  config?: ToolConfig
}

class ToolAdapterImpl implements ToolAdapter {
  private handlers = new Map<string, ToolHandler>()

  constructor() {
    this.registerDefaults()
  }

  /**
   * Register default built-in tool stubs.
   */
  private registerDefaults(): void {
    // MCP Tool
    this.registerHandler({
      type: 'mcp',
      name: 'mcp',
      status: 'not_installed',
      invoke: async (params) => ({
        success: false,
        error: 'MCP Tool not installed. Use tool.install("mcp", config) first.',
        durationMs: 0,
      }),
    })

    // Browser Tool
    this.registerHandler({
      type: 'browser',
      name: 'browser',
      status: 'not_installed',
      invoke: async (params) => ({
        success: false,
        error: 'Browser Tool not installed. Use tool.install("browser", config) first.',
        durationMs: 0,
      }),
    })

    // Search Tool
    this.registerHandler({
      type: 'search',
      name: 'search',
      status: 'not_installed',
      invoke: async (params) => ({
        success: false,
        error: 'Search Tool not installed. Use tool.install("search", config) first.',
        durationMs: 0,
      }),
    })

    // Python Tool
    this.registerHandler({
      type: 'python',
      name: 'python',
      status: 'not_installed',
      invoke: async (params) => ({
        success: false,
        error: 'Python Tool not installed. Use tool.install("python", config) first.',
        durationMs: 0,
      }),
    })

    // Database Tool
    this.registerHandler({
      type: 'database',
      name: 'database',
      status: 'not_installed',
      invoke: async (params) => ({
        success: false,
        error: 'Database Tool not installed. Use tool.install("database", config) first.',
        durationMs: 0,
      }),
    })

    // HTTP Tool
    this.registerHandler({
      type: 'http',
      name: 'http',
      status: 'not_installed',
      invoke: async (params) => ({
        success: false,
        error: 'HTTP Tool not installed. Use tool.install("http", config) first.',
        durationMs: 0,
      }),
    })

    // Filesystem Tool
    this.registerHandler({
      type: 'filesystem',
      name: 'filesystem',
      status: 'not_installed',
      invoke: async (params) => ({
        success: false,
        error: 'Filesystem Tool not installed. Use tool.install("filesystem", config) first.',
        durationMs: 0,
      }),
    })

    // Custom Tool
    this.registerHandler({
      type: 'custom',
      name: 'custom',
      status: 'not_installed',
      invoke: async (params) => ({
        success: false,
        error: 'Custom Tool not installed. Use tool.install("custom", config) first.',
        durationMs: 0,
      }),
    })
  }

  /**
   * Register a handler internally.
   */
  private registerHandler(handler: ToolHandler): void {
    this.handlers.set(`${handler.type}:${handler.name}`, handler)
  }

  /**
   * Invoke a tool.
   */
  async invoke(
    type: ToolType,
    name: string,
    params: Record<string, unknown>,
    ctx?: AgentContext,
  ): Promise<ToolResult> {
    const key = `${type}:${name}`
    const handler = this.handlers.get(key)

    if (!handler) {
      return {
        success: false,
        error: `Tool not found: ${type}/${name}`,
        durationMs: 0,
      }
    }

    if (handler.status === 'not_installed' || handler.status === 'unavailable') {
      return {
        success: false,
        error: `Tool ${type}/${name} is ${handler.status}. Install it first.`,
        durationMs: 0,
      }
    }

    const startTime = Date.now()
    try {
      ctx?.logger.debug(`[ToolAdapter] Invoking ${type}/${name}`, params)
      const result = await handler.invoke(params, ctx)
      result.durationMs = Date.now() - startTime
      return result
    } catch (err) {
      ctx?.logger.error(`[ToolAdapter] Error invoking ${type}/${name}`, err)
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Install/reconfigure a tool.
   */
  async install(type: ToolType, config: ToolConfig): Promise<void> {
    const key = `${type}:${type}`
    const existing = this.handlers.get(key)

    if (existing) {
      existing.config = config
      existing.status = config.enabled ? 'available' : 'unavailable'

      if (config.enabled && config.options?._handler) {
        // Replace the handler if a custom implementation is provided
        existing.invoke = config.options._handler as any
      }

      console.log(`[ToolAdapter] Installed ${type}: enabled=${config.enabled}`)
    } else {
      throw new PlatformError('INVALID_TOOL_TYPE', `Unknown tool type: ${type}`)
    }
  }

  /**
   * Uninstall a tool.
   */
  async uninstall(type: ToolType): Promise<void> {
    const key = `${type}:${type}`
    const handler = this.handlers.get(key)
    if (handler) {
      handler.status = 'not_installed'
      handler.config = undefined
    }
  }

  /**
   * List available (installed) tool types.
   */
  listAvailable(): ToolType[] {
    const types: ToolType[] = []
    for (const handler of this.handlers.values()) {
      if (handler.status === 'available' && !types.includes(handler.type)) {
        types.push(handler.type)
      }
    }
    return types
  }

  /**
   * Get the status of a tool type.
   */
  getStatus(type: ToolType): ToolStatus {
    const handler = this.handlers.get(`${type}:${type}`)
    return handler?.status || 'not_installed'
  }
}

// Singleton
export const toolAdapter: ToolAdapter = new ToolAdapterImpl()
