/**
 * EventBus — Platform event system (REAL in-memory implementation).
 *
 * Provides real pub/sub for cross-workspace communication.
 * Events are fire-and-forget notifications of facts that have occurred.
 *
 * Features:
 * - publish: deliver events to all subscribers of that type
 * - subscribe: register a handler for an event type (returns unsubscribe)
 * - once: one-shot subscription (auto-unsubscribes after first event)
 * - Error isolation: one failing subscriber doesn't block others
 * - Priority-based ordering: lower priority numbers fire first
 *
 * @package @studio/platform/event
 * @see EVENT-SPEC.md §2 (Event/Command/Query Separation)
 */

/**
 * Standard event payload structure.
 * All events must follow this format.
 */
export interface StudioEvent<T = unknown> {
  /** Event type in `domain:action` format */
  type: string;

  /** Event payload */
  payload: T;

  /** Event metadata (automatically attached by platform) */
  metadata: EventMetadata;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Distributed tracing ID */
  traceId: string;

  /** Globally unique event ID (for deduplication) */
  eventId: string;

  /** Event schema version */
  version: number;
}

/**
 * Event metadata — automatically attached by the platform.
 */
export interface EventMetadata {
  /** Source workspace */
  source: string;

  /** User who triggered the event */
  userId?: string;

  /** Related project */
  projectId?: string;

  /** Related session */
  sessionId?: string;

  /** Parent trace ID for event chains */
  parentTraceId?: string;

  /** Custom tags */
  tags?: string[];
}

/**
 * Event handler function signature.
 */
export type EventHandler<T = unknown> = (
  event: StudioEvent<T>
) => Promise<void> | void;

/**
 * Function returned from subscribe() — call to unsubscribe.
 */
export type UnsubscribeFn = () => Promise<void>;

/**
 * Options for subscribing to events.
 */
export interface SubscribeOptions {
  /** Only handle the event once */
  once?: boolean;

  /** Filter events by payload conditions */
  filter?: (event: StudioEvent) => boolean;

  /** Priority (lower number = higher priority, default: 100) */
  priority?: number;
}

/**
 * Internal subscriber entry.
 */
interface SubscriberEntry {
  handler: EventHandler;
  options?: SubscribeOptions;
  /** Unique subscriber ID for tracking */
  id: string;
}

/**
 * Standard event type constants.
 */
export const EventTypes = {
  // Project events
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_ARCHIVED: 'project:archived',
  PROJECT_DELETED: 'project:deleted',

  // Asset events
  ASSET_IMPORTED: 'asset:imported',
  ASSET_DELETED: 'asset:deleted',
  ASSET_PROCESSED: 'asset:processed',

  // Workflow events
  WORKFLOW_STARTED: 'workflow:started',
  WORKFLOW_NODE_COMPLETED: 'workflow:node:completed',
  WORKFLOW_NODE_FAILED: 'workflow:node:failed',
  WORKFLOW_FINISHED: 'workflow:finished',
  WORKFLOW_FAILED: 'workflow:failed',
  WORKFLOW_CANCELLED: 'workflow:cancelled',

  // Knowledge events
  CITATION_GENERATED: 'citation:generated',
  KNOWLEDGE_UPDATED: 'knowledge:updated',
  KNOWLEDGE_QUALITY_CHECKED: 'knowledge:quality:checked',

  // Capability events
  CAPABILITY_INVOKED: 'capability:invoked',
  CAPABILITY_FAILED: 'capability:failed',
  CAPABILITY_FALLBACK: 'capability:fallback',

  // Workspace events
  WORKSPACE_REGISTERED: 'workspace:registered',
  WORKSPACE_DISPOSED: 'workspace:disposed',
} as const;

/**
 * EventBus — REAL in-memory pub/sub implementation.
 *
 * Provides:
 * - Real publish/subscribe with automatic event creation
 * - once() for one-shot handlers
 * - Error isolation per subscriber (one failure doesn't crash others)
 * - Priority ordering for handlers
 * - Wildcard subscriptions (e.g., 'project:*')
 * - Event creation helper for consistent event formatting
 */
export class EventBus {
  private subscribers: Map<string, SubscriberEntry[]> = new Map();
  private subscriberIdCounter = 0;

  /**
   * Create a properly formatted event object.
   * Useful for workspaces to create events before publishing.
   */
  createEvent<T>(
    type: string,
    payload: T,
    metadata?: Partial<EventMetadata>
  ): StudioEvent<T> {
    return {
      type,
      payload,
      metadata: {
        source: metadata?.source || 'platform',
        userId: metadata?.userId,
        projectId: metadata?.projectId,
        sessionId: metadata?.sessionId,
        parentTraceId: metadata?.parentTraceId,
        tags: metadata?.tags,
      },
      timestamp: new Date().toISOString(),
      traceId: `trace-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`,
      version: 1,
    };
  }

  /**
   * Publish an event to all subscribers of its type.
   *
   * - Subscribers matching the exact event type are called
   * - Subscribers with wildcard patterns (e.g., 'project:*') are called
   * - Subscribers are ordered by priority (lower = first)
   * - If one subscriber throws, others still receive the event
   *
   * @param event - The event to publish (can be created via createEvent)
   */
  async publish<T>(event: StudioEvent<T>): Promise<void> {
    const handlers = this.getSubscribersForType(event.type);
    if (handlers.length === 0) return;

    // Sort by priority (lower number = higher priority)
    handlers.sort((a, b) => (a.options?.priority ?? 100) - (b.options?.priority ?? 100));

    // Create copies array for safe iteration (in case handlers unsubscribe during iteration)
    const toRemove: string[] = [];

    for (const entry of handlers) {
      // Skip if handler was unsubscribed during iteration
      if (toRemove.includes(entry.id)) continue;

      // Apply filter if specified
      if (entry.options?.filter && !entry.options.filter(event)) continue;

      try {
        await entry.handler(event);
      } catch (err) {
        console.error(`[EventBus] Handler ${entry.id} error for ${event.type}:`, err);
      }

      // Auto-remove once handlers
      if (entry.options?.once) {
        toRemove.push(entry.id);
      }
    }

    // Clean up once handlers
    if (toRemove.length > 0) {
      const remaining = (this.subscribers.get(event.type) || [])
        .filter(e => !toRemove.includes(e.id));
      if (remaining.length > 0) {
        this.subscribers.set(event.type, remaining);
      } else {
        this.subscribers.delete(event.type);
      }
    }
  }

  /**
   * Publish a simple event by type and payload.
   * Convenience wrapper that creates the event object for you.
   */
  async publishEvent<T>(
    type: string,
    payload: T,
    metadata?: Partial<EventMetadata>
  ): Promise<void> {
    const event = this.createEvent(type, payload, metadata);
    return this.publish(event);
  }

  /**
   * Subscribe to an event type.
   *
   * @param type - Event type to subscribe to (supports wildcard '*' pattern)
   * @param handler - Event handler function
   * @param options - Subscription options (once, filter, priority)
   * @returns Unsubscribe function
   */
  async subscribe<T>(
    type: string,
    handler: EventHandler<T>,
    options?: SubscribeOptions
  ): Promise<UnsubscribeFn> {
    const id = `sub-${++this.subscriberIdCounter}`;
    const entry: SubscriberEntry = {
      handler: handler as EventHandler,
      options,
      id,
    };

    const existing = this.subscribers.get(type) || [];
    existing.push(entry);
    this.subscribers.set(type, existing);

    return async () => {
      const handlers = this.subscribers.get(type) || [];
      const filtered = handlers.filter(h => h.id !== id);
      if (filtered.length > 0) {
        this.subscribers.set(type, filtered);
      } else {
        this.subscribers.delete(type);
      }
    };
  }

  /**
   * Subscribe to an event type for exactly one occurrence.
   * Convenience wrapper around subscribe({ once: true }).
   */
  async once<T>(
    type: string,
    handler: EventHandler<T>,
    filter?: (event: StudioEvent) => boolean
  ): Promise<UnsubscribeFn> {
    return this.subscribe(type, handler, { once: true, filter });
  }

  /**
   * Unsubscribe a handler from an event type.
   */
  async unsubscribe<T>(type: string, handler: EventHandler<T>): Promise<void> {
    const handlers = this.subscribers.get(type) || [];
    const filtered = handlers.filter(h => h.handler !== handler);
    if (filtered.length > 0) {
      this.subscribers.set(type, filtered);
    } else {
      this.subscribers.delete(type);
    }
  }

  /**
   * Wait for an event of the given type.
   * Returns a promise that resolves with the first matching event.
   */
  waitFor<T>(type: string, timeoutMs?: number, filter?: (event: StudioEvent) => boolean): Promise<StudioEvent<T>> {
    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;

      this.subscribe<T>(type, (event) => {
        if (timeout) clearTimeout(timeout);
        resolve(event);
      }, { once: true, filter }).catch(reject);

      if (timeoutMs && timeoutMs > 0) {
        timeout = setTimeout(() => {
          reject(new Error(`[EventBus] Timeout waiting for event: ${type}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Get the count of active subscribers for a type (or total).
   */
  subscriberCount(type?: string): number {
    if (type) {
      return this.subscribers.get(type)?.length || 0;
    }
    let count = 0;
    this.subscribers.forEach(handlers => {
      count += handlers.length;
    });
    return count;
  }

  /**
   * List all subscribed event types.
   */
  subscribedTypes(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Clear all subscribers (for testing/teardown).
   */
  clear(): void {
    this.subscribers.clear();
    this.subscriberIdCounter = 0;
  }

  // ============ Private Helpers ============

  /**
   * Get all subscriber entries that match an event type.
   * Matches exact types AND wildcard patterns.
   */
  private getSubscribersForType(type: string): SubscriberEntry[] {
    const results: SubscriberEntry[] = [];
    const parts = type.split(':');

    // 1. Exact match
    const exact = this.subscribers.get(type);
    if (exact) results.push(...exact);

    // 2. Wildcard: 'domain:*' matches 'domain:action'
    const wildcard = `${parts[0]}:*`;
    if (wildcard !== type) {
      const wc = this.subscribers.get(wildcard);
      if (wc) results.push(...wc);
    }

    // 3. Global wildcard: '*' matches everything
    const global = this.subscribers.get('*');
    if (global) results.push(...global);

    return results;
  }
}
