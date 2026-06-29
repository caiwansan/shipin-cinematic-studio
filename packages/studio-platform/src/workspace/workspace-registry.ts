/**
 * Workspace Registry — Central registry for all workspace adapters.
 *
 * The platform discovers workspaces through this registry.
 * Every workspace MUST register its adapter here during platform initialization.
 *
 * @package @studio/platform/workspace
 * @see WORKSPACE-SPEC.md §3
 * @see ADR-002 (Workspace Adapter Pattern)
 */

import type { WorkspaceAdapter, WorkspaceType } from './workspace-adapter';

/**
 * Workspace Registry — Singleton holding all registered WorkspaceAdapter instances.
 *
 * Responsibilities:
 * - Register workspace adapters on platform boot
 * - Lookup adapters by type
 * - List all available adapters
 * - Track active workspace
 */
export class WorkspaceRegistry {
  private static instance: WorkspaceRegistry;
  private adapters: Map<WorkspaceType, WorkspaceAdapter> = new Map();
  private activeType: WorkspaceType | null = null;

  private constructor() {
    // Singleton — use getInstance()
  }

  /**
   * Get the singleton registry instance.
   */
  static getInstance(): WorkspaceRegistry {
    if (!WorkspaceRegistry.instance) {
      WorkspaceRegistry.instance = new WorkspaceRegistry();
    }
    return WorkspaceRegistry.instance;
  }

  /**
   * Register a workspace adapter.
   * Called during platform initialization (bootstrap phase).
   *
   * @param adapter - The workspace adapter to register
   * @throws Error if a workspace of the same type is already registered
   */
  register(adapter: WorkspaceAdapter): void {
    const type = adapter.type;
    if (this.adapters.has(type)) {
      throw new Error(`Workspace type '${type}' is already registered`);
    }
    this.adapters.set(type, adapter);
  }

  /**
   * Get a workspace adapter by type.
   *
   * @param type - The workspace type to look up
   * @returns The registered adapter, or undefined if not found
   */
  get(type: WorkspaceType): WorkspaceAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * List all registered workspace adapters.
   *
   * @returns Array of registered adapter type-adapter pairs
   */
  list(): Array<{ type: WorkspaceType; adapter: WorkspaceAdapter }> {
    return Array.from(this.adapters.entries()).map(([type, adapter]) => ({
      type,
      adapter,
    }));
  }

  /**
   * Get the currently active workspace type.
   * Used by the platform to determine which workspace UI to display.
   */
  getActive(): WorkspaceType | null {
    return this.activeType;
  }

  /**
   * Set the active workspace.
   * Called when a user navigates to a specific workspace.
   */
  setActive(type: WorkspaceType): void {
    if (!this.adapters.has(type)) {
      throw new Error(`Cannot activate unregistered workspace type: ${type}`);
    }
    this.activeType = type;
  }

  /**
   * Check if a workspace type is registered.
   */
  has(type: WorkspaceType): boolean {
    return this.adapters.has(type);
  }

  /**
   * Get the count of registered workspaces.
   */
  get count(): number {
    return this.adapters.size;
  }

  /**
   * Unregister a workspace adapter.
   * Called during workspace disposal.
   */
  unregister(type: WorkspaceType): void {
    this.adapters.delete(type);
    if (this.activeType === type) {
      this.activeType = null;
    }
  }

  /**
   * Clear all registered adapters (for testing/teardown).
   */
  clear(): void {
    this.adapters.clear();
    this.activeType = null;
  }
}
