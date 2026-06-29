/**
 * Platform Runtime — REAL implementation wrapping WorkspaceAdapter lifecycle.
 *
 * Manages workspace lifecycle through the adapter pattern:
 * - initialize(): boot workspaces and their dependencies
 * - activate(): switch to a specific workspace context
 * - deactivate(): pause current workspace context
 * - dispose(): full teardown of workspace resources
 *
 * REAL implementation: calls through to the actual workspace adapter
 * lifecycle methods. NOT a shim.
 *
 * @package @studio/platform/runtime
 * @see RUNTIME-SPEC.md §2
 * @see ADR-001 (Single Runtime)
 */

import type { WorkspaceType } from '../workspace/workspace-adapter';
import { WorkspaceRegistry } from '../workspace/workspace-registry';
import type { WorkspaceContext } from '../workspace/workspace-adapter';
import { EventBus } from '../event/event-bus';
import { CapabilityRuntime } from '../capability/capability-runtime';

/**
 * Execution runtime — manages single operation execution lifecycle.
 */
export interface ExecutionRuntime {
  registerAction<TInput, TOutput>(
    id: string,
    handler: (input: TInput, ctx: RuntimeContext) => Promise<TOutput>
  ): void;

  execute<TInput, TOutput>(
    actionId: string,
    input: TInput,
    ctx?: Partial<RuntimeContext>
  ): Promise<ExecutionResult<TOutput>>;

  getStatus(executionId: string): Promise<ExecutionStatus>;
  cancel(executionId: string): Promise<void>;
}

/**
 * Workflow runtime — manages DAG-based workflow execution.
 */
export interface WorkflowRuntime {
  registerDAG(dag: DAGDefinition): Promise<void>;
  trigger<TInput>(workflowId: string, input: TInput): Promise<WorkflowExecution>;
  getExecution(executionId: string): Promise<WorkflowExecution>;
  pause(executionId: string): Promise<void>;
  resume(executionId: string): Promise<void>;
  cancel(executionId: string): Promise<void>;
}

// ============ Supporting Types ============

export interface RuntimeContext {
  userId: string;
  projectId?: string;
  workspaceId: string;
  sessionId: string;
  membership: {
    tier: 'free' | 'basic' | 'vip' | 'enterprise';
    features: string[];
  };
}

export interface ExecutionResult<TOutput = unknown> {
  executionId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'running';
  output?: TOutput;
  error?: { code: string; message: string };
  durationMs: number;
}

export interface ExecutionStatus {
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  startedAt: string;
  completedAt?: string;
}

export interface DAGDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: DAGNode[];
  config?: { maxRetries?: number; timeoutMs?: number; continueOnFailure?: boolean };
}

export interface DAGNode {
  id: string;
  agent: string;
  dependsOn: string[];
  config?: { retries?: number; timeoutMs?: number; inputMapping?: Record<string, string> };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  nodeStates: Array<{ nodeId: string; status: string }>;
  startedAt: string;
  completedAt?: string;
}

/**
 * Platform boot configuration.
 */
export interface PlatformBootConfig {
  userId?: string;
  tenantId?: string;
  capabilities?: Record<string, unknown>;
}

/**
 * Wrapped adapter state tracking.
 */
interface WrappedAdapter {
  type: WorkspaceType;
  adapterType: string;
  initialized: boolean;
  active: boolean;
}

/**
 * Platform Runtime — REAL implementation.
 *
 * Manages workspace lifecycle by calling through to the actual
 * WorkspaceAdapter lifecycle methods (initialize/activate/deactivate/dispose).
 *
 * Lifecycle states:
 * ┌──────────┐  initialize()  ┌─────────────┐  activate()  ┌─────────┐
 * │ CREATED  │ ─────────────> │ INITIALIZED  │ ───────────> │ ACTIVE  │
 * └──────────┘                └─────────────┘              └─────────┘
 *                                    │                          │
 *                                    │ dispose()                │ deactivate()
 *                                    v                          v
 *                              ┌─────────────┐              ┌──────────┐
 *                              │  DISPOSED   │              │ INACTIVE │
 *                              └─────────────┘              └──────────┘
 */
export class PlatformRuntime {
  private registry: WorkspaceRegistry;
  private eventBus: EventBus | null = null;
  private capabilityRuntime: CapabilityRuntime | null = null;
  private activeWorkspaceType: WorkspaceType | null = null;
  private initializedTypes: Set<string> = new Set();
  private disposed = false;
  private wrappedAdapters: Map<string, WrappedAdapter> = new Map();

  constructor(
    registry: WorkspaceRegistry,
    eventBus?: EventBus,
    capabilityRuntime?: CapabilityRuntime
  ) {
    this.registry = registry;
    this.eventBus = eventBus || null;
    this.capabilityRuntime = capabilityRuntime || null;
  }

  /**
   * Initialize a workspace type.
   * Calls the adapter's initialize() method with a platform context.
   * If the adapter is already initialized, skips (idempotent).
   */
  async initialize(type: WorkspaceType, config?: PlatformBootConfig): Promise<void> {
    if (this.disposed) {
      throw new Error('[PlatformRuntime] Cannot initialize after dispose');
    }

    const adapter = this.registry.get(type);
    if (!adapter) {
      throw new Error(`[PlatformRuntime] Cannot initialize unregistered workspace: ${type}`);
    }

    const key = String(type);
    if (this.initializedTypes.has(key)) {
      console.log(`[PlatformRuntime] Workspace ${type} already initialized — skipping`);
      return;
    }

    // Build the platform context for the adapter
    const context: WorkspaceContext = {
      projectId: '',
      userId: config?.userId || 'system',
      tenantId: config?.tenantId || 'system',
      capabilities: new Map(config?.capabilities ? Object.entries(config.capabilities) : []),
      stateRuntime: null,
      eventBus: this.eventBus,
    };

    // If we have capabilityRuntime, register its LLM capability as a context capability
    if (this.capabilityRuntime) {
      context.capabilities.set('llm.generate', this.capabilityRuntime.createLLMCapability());
    }

    // REAL CALL: invoke the adapter's initialize method
    await adapter.initialize(context);

    this.initializedTypes.add(key);
    this.wrappedAdapters.set(key, {
      type,
      adapterType: adapter.type,
      initialized: true,
      active: false,
    });

    console.log(`[PlatformRuntime] Workspace ${type} initialized successfully`);
  }

  /**
   * Activate a workspace for the current session.
   * Calls the adapter's activate() method.
   */
  async activate(type: WorkspaceType, projectId?: string): Promise<void> {
    if (this.disposed) {
      throw new Error('[PlatformRuntime] Cannot activate after dispose');
    }

    const adapter = this.registry.get(type);
    if (!adapter) {
      throw new Error(`[PlatformRuntime] Cannot activate unregistered workspace: ${type}`);
    }

    const key = String(type);

    // Ensure initialized
    if (!this.initializedTypes.has(key)) {
      await this.initialize(type);
    }

    // Deactivate current if different
    if (this.activeWorkspaceType && this.activeWorkspaceType !== type) {
      await this.deactivate();
    }

    // REAL CALL: invoke the adapter's activate method
    await adapter.activate(projectId || '');

    this.activeWorkspaceType = type;
    const wrapped = this.wrappedAdapters.get(key);
    if (wrapped) wrapped.active = true;

    console.log(`[PlatformRuntime] Workspace ${type} activated${projectId ? ` for project: ${projectId}` : ''}`);
  }

  /**
   * Deactivate the current workspace.
   * Calls the adapter's deactivate() method.
   */
  async deactivate(): Promise<void> {
    if (!this.activeWorkspaceType) return;

    const adapter = this.registry.get(this.activeWorkspaceType);
    if (adapter) {
      // REAL CALL: invoke the adapter's deactivate method
      await adapter.deactivate();
    }

    const key = String(this.activeWorkspaceType);
    const wrapped = this.wrappedAdapters.get(key);
    if (wrapped) wrapped.active = false;

    console.log(`[PlatformRuntime] Workspace ${this.activeWorkspaceType} deactivated`);
    this.activeWorkspaceType = null;
  }

  /**
   * Dispose workspace resources on platform shutdown.
   * Calls each initialized adapter's dispose() method.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;

    // Deactivate first if active
    if (this.activeWorkspaceType) {
      await this.deactivate();
    }

    // Dispose all initialized adapters
    const types = Array.from(this.initializedTypes);
    for (const key of types) {
      const adapter = this.registry.get(key as WorkspaceType);
      if (adapter) {
        try {
          // REAL CALL: invoke the adapter's dispose method
          await adapter.dispose();
          console.log(`[PlatformRuntime] Workspace ${key} disposed`);
        } catch (err) {
          console.error(`[PlatformRuntime] Error disposing ${key}:`, err);
        }
      }
    }

    this.initializedTypes.clear();
    this.wrappedAdapters.clear();
    this.disposed = true;

    console.log('[PlatformRuntime] All workspaces disposed');
  }

  /**
   * Get the currently active workspace type.
   */
  getActiveWorkspace(): WorkspaceType | null {
    return this.activeWorkspaceType;
  }

  /**
   * Check if a workspace type has been initialized.
   */
  isInitialized(type: WorkspaceType): boolean {
    return this.initializedTypes.has(String(type));
  }

  /**
   * Get all initialized workspace types with their status.
   */
  getStatus(): Array<{ type: WorkspaceType; initialized: boolean; active: boolean }> {
    return Array.from(this.wrappedAdapters.entries()).map(([key, w]) => ({
      type: w.type,
      initialized: w.initialized,
      active: w.active,
    }));
  }

  // ============ Runtime Subsystems ============

  /**
   * Access to execution runtime.
   * C1: basic implementation with action registration and execution.
   */
  get execution(): ExecutionRuntime {
    return this.createExecutionRuntime();
  }

  /**
   * Access to workflow runtime.
   * C1 shim — real implementation in C2.
   */
  get workflow(): WorkflowRuntime {
    return {} as WorkflowRuntime;
  }

  // ============ Private Helpers ============

  private createExecutionRuntime(): ExecutionRuntime {
    const actions = new Map<string, (input: unknown, ctx: RuntimeContext) => Promise<unknown>>();

    return {
      registerAction<TInput, TOutput>(
        id: string,
        handler: (input: TInput, ctx: RuntimeContext) => Promise<TOutput>
      ) {
        actions.set(id, handler as (input: unknown, ctx: RuntimeContext) => Promise<unknown>);
      },

      async execute<TInput, TOutput>(
        actionId: string,
        input: TInput,
        ctx?: Partial<RuntimeContext>
      ): Promise<ExecutionResult<TOutput>> {
        const handler = actions.get(actionId);
        if (!handler) {
          return {
            executionId: `exec-${Date.now()}`,
            status: 'failed',
            error: { code: 'ACTION_NOT_FOUND', message: `No action registered: ${actionId}` },
            durationMs: 0,
          };
        }

        const startTime = Date.now();
        try {
          const context: RuntimeContext = {
            userId: ctx?.userId || 'system',
            projectId: ctx?.projectId,
            workspaceId: ctx?.workspaceId || 'default',
            sessionId: ctx?.sessionId || `sess-${Date.now()}`,
            membership: ctx?.membership || { tier: 'free', features: [] },
          };

          const result = await handler(input, context);
          return {
            executionId: `exec-${Date.now()}`,
            status: 'completed',
            output: result as TOutput,
            durationMs: Date.now() - startTime,
          };
        } catch (err) {
          return {
            executionId: `exec-${Date.now()}`,
            status: 'failed',
            error: { code: 'EXECUTION_ERROR', message: (err as Error).message },
            durationMs: Date.now() - startTime,
          };
        }
      },

      async getStatus(_executionId: string): Promise<ExecutionStatus> {
        return { executionId: _executionId, status: 'completed', startedAt: new Date().toISOString() };
      },

      async cancel(_executionId: string): Promise<void> {
        // C1: no-op
      },
    };
  }
}
