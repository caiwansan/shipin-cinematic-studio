// ============================================================
// Action Registry — Plugin-style registration center
// Actions register themselves; adding new Action doesn't modify core Runtime
// ============================================================

import type { ActionHandler, ActionRegistryEntry, ActionResult } from '../types.js'

class ActionRegistry {
  private actions: Map<string, ActionRegistryEntry> = new Map()

  /**
   * Register an action handler
   */
  register(action: ActionHandler, config?: Record<string, unknown>): void {
    if (this.actions.has(action.name)) {
      console.warn(`[ActionRegistry] Overwriting existing action: ${action.name}`)
    }
    this.actions.set(action.name, {
      action,
      config,
      registeredAt: new Date(),
    })
    console.log(`[ActionRegistry] ✅ Registered action: ${action.name} (${action.provider})`)
  }

  /**
   * Get an action handler by name
   */
  get(name: string): ActionHandler | undefined {
    const entry = this.actions.get(name)
    return entry?.action
  }

  /**
   * List all registered action entries
   */
  list(): ActionRegistryEntry[] {
    return Array.from(this.actions.values())
  }

  /**
   * List all registered action names
   */
  listNames(): string[] {
    return Array.from(this.actions.keys())
  }

  /**
   * Check if an action is registered
   */
  has(name: string): boolean {
    return this.actions.has(name)
  }

  /**
   * Execute an action by name
   */
  async execute(name: string, input: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<ActionResult> {
    const entry = this.actions.get(name)
    if (!entry) {
      return {
        success: false,
        error: `Action not found: ${name}. Available: ${this.listNames().join(', ')}`,
      }
    }

    const startTime = Date.now()
    try {
      const result = await entry.action.execute(input, metadata)
      return {
        ...result,
        durationMs: Date.now() - startTime,
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown error during action execution',
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Unregister an action
   */
  unregister(name: string): boolean {
    return this.actions.delete(name)
  }

  /**
   * Get the count of registered actions
   */
  get count(): number {
    return this.actions.size
  }
}

// Singleton
export const actionRegistry = new ActionRegistry()
