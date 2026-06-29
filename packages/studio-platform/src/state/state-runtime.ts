/**
 * StateRuntime — Platform state management (C1 stub).
 *
 * Real implementation in C2. For C1, defines the interface
 * that workspace adapters and services depend on.
 *
 * Key principle: State is derived from events, not the other way around.
 * Direct state modification should be rare — prefer publishing events
 * that trigger state projections.
 *
 * @package @studio/platform/state
 * @see STATE-SPEC.md §4 (State derived from events)
 */

/**
 * Workspace-level state identifier.
 */
export type StateScope =
  | { type: 'workspace'; workspaceId: string }
  | { type: 'runtime'; instanceId: string }
  | { type: 'workflow'; executionId: string }
  | { type: 'task'; taskId: string }
  | { type: 'global' };

/**
 * Options for setting state.
 */
export interface SetStateOptions {
  /** State TTL in milliseconds */
  ttlMs?: number;
  /** Optimistic lock version */
  expectedVersion?: number;
  /** Broadcast change event */
  broadcast?: boolean;
}

/**
 * Workspace-level configuration and preferences.
 */
export interface WorkspaceState {
  workspaceId: string;
  features: Record<string, boolean>;
  preferences: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    notifications?: boolean;
    [key: string]: unknown;
  };
  lastActiveAt: string;
  config: Record<string, unknown>;
}

/**
 * Transient UI state — perdium state is handled by the platform.
 */
export interface UIState {
  activeModal?: string;
  sidebarCollapsed: boolean;
  activeTab?: string;
  formDraft?: Record<string, unknown>;
  scrollPosition?: number;
  searchQuery?: string;
}

// ============ State Runtime (C1 Stub) ============

/**
 * StateRuntime — C1 interface stub.
 *
 * Real implementation in C2 will:
 * - Provide persistent state storage (Redis + DB)
 * - Support state subscriptions and change notifications
 * - Drive state from event projections
 * - Handle crash recovery via event replay
 * - Manage TTL-based state expiration
 *
 * For C1, state is stored in-memory only (no persistence).
 * Do NOT use for anything that needs to survive a restart.
 */
export class StateRuntime {
  private store: Map<string, Map<string, unknown>> = new Map();
  private subscribers: Map<
    string,
    Array<(value: unknown, oldValue: unknown) => void>
  > = new Map();

  /**
   * Get state value by scope and key.
   */
  async getState<T>(scope: StateScope, key: string): Promise<T | null> {
    const scopeKey = this.scopeToKey(scope);
    const scopeStore = this.store.get(scopeKey);
    if (!scopeStore) return null;
    return (scopeStore.get(key) as T) ?? null;
  }

  /**
   * Set state value by scope and key.
   * If options.ttlMs is set, the state will be automatically removed after TTL.
   */
  async setState<T>(
    scope: StateScope,
    key: string,
    value: T,
    _options?: SetStateOptions
  ): Promise<void> {
    const scopeKey = this.scopeToKey(scope);
    let scopeStore = this.store.get(scopeKey);
    if (!scopeStore) {
      scopeStore = new Map();
      this.store.set(scopeKey, scopeStore);
    }

    const oldValue = scopeStore.get(key);
    scopeStore.set(key, value);

    // Notify subscribers
    this.notifySubscribers(`${scopeKey}:${key}`, value, oldValue);

    // Handle TTL if specified
    if (_options?.ttlMs && _options.ttlMs > 0) {
      setTimeout(() => {
        scopeStore?.delete(key);
      }, _options.ttlMs);
    }
  }

  /**
   * Delete a state value.
   */
  async deleteState(scope: StateScope, key: string): Promise<void> {
    const scopeKey = this.scopeToKey(scope);
    const scopeStore = this.store.get(scopeKey);
    if (scopeStore) {
      const oldValue = scopeStore.get(key);
      scopeStore.delete(key);
      this.notifySubscribers(`${scopeKey}:${key}`, null, oldValue);
    }
  }

  /**
   * Subscribe to state changes for a specific scope+key.
   * Returns an unsubscribe function.
   */
  async subscribe<T>(
    scope: StateScope,
    key: string,
    callback: (value: T | null, oldValue: T | null) => void
  ): Promise<() => void> {
    const fullKey = `${this.scopeToKey(scope)}:${key}`;
    const existing = this.subscribers.get(fullKey) || [];
    existing.push(callback as (value: unknown, oldValue: unknown) => void);
    this.subscribers.set(fullKey, existing);

    return () => {
      const handlers = this.subscribers.get(fullKey) || [];
      this.subscribers.set(
        fullKey,
        handlers.filter((h) => h !== callback)
      );
    };
  }

  /**
   * Clear all state (for testing/teardown).
   */
  clear(): void {
    this.store.clear();
    this.subscribers.clear();
  }

  // ============ Private Helpers ============

  private scopeToKey(scope: StateScope): string {
    switch (scope.type) {
      case 'workspace':
        return `ws:${scope.workspaceId}`;
      case 'runtime':
        return `rt:${scope.instanceId}`;
      case 'workflow':
        return `wf:${scope.executionId}`;
      case 'task':
        return `task:${scope.taskId}`;
      case 'global':
        return 'global';
    }
  }

  private notifySubscribers(
    key: string,
    value: unknown,
    oldValue: unknown
  ): void {
    const handlers = this.subscribers.get(key);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(value, oldValue);
        } catch (err) {
          console.error(`[StateRuntime] Subscriber error for ${key}:`, err);
        }
      });
    }
  }
}
