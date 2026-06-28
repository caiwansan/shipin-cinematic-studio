// ============================================================
// Workflow Runtime (KMKI-PLAT-011)
// ARCH-002 Lifecycle: Init → Load → Validate → Execute → Update → Dispose
// Uses PlatformContext, EventBus, PlatformError
// ============================================================

import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle'
import type { PlatformContext } from '@platform/context/platform-context'
import { RuntimeError } from '@platform/errors/platform-errors'
import { platformEventBus } from '@platform/events/event-bus'
import { workflowService } from '../workflow.service.js'
import { workflowContextFactory } from '../context/workflow-context.js'
import { workflowRegistry } from '../registry/workflow-registry.js'
import { workflowVariablesManager } from '../variables/workflow-variables.js'
import { registerHumanNodeTypes } from '../human/human-nodes.js'
import type { WorkflowDefinition, WorkflowInstance } from '../types.js'

export interface WorkflowRuntimeInput {
  workflowCode: string
  workspaceId: string
  input?: Record<string, any>
  instanceId?: string
}

export interface WorkflowRuntimeOutput {
  instanceId: string
  status: string
  result?: Record<string, any>
  error?: string
}

export class WorkflowRuntime implements RuntimeLifecycle<WorkflowRuntimeInput, WorkflowRuntimeOutput> {
  private initialized = false
  private config: Record<string, any> = {}

  // ─── Init ───

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return

    this.config = config || {}
    this.initialized = true

    // Register human node types
    registerHumanNodeTypes()

    console.log('[WorkflowRuntime] Initialized with config:', JSON.stringify(this.config))
  }

  // ─── Load ───

  async load(ctx: PlatformContext, id: string): Promise<WorkflowRuntimeInput> {
    const instance = await workflowService.getInstance(id)
    if (!instance) {
      throw new RuntimeError('Workflow instance not found', { instanceId: id })
    }

    const definition = await workflowRegistry.findById(instance.workflowId)
    if (!definition) {
      throw new RuntimeError('Workflow definition not found', { workflowId: instance.workflowId })
    }

    return {
      workflowCode: definition.code,
      workspaceId: instance.workspaceId,
      instanceId: instance.id,
      input: typeof instance.input === 'object' ? instance.input as any : JSON.parse(instance.input || '{}'),
    }
  }

  // ─── Validate ───

  async validate(ctx: PlatformContext, input: WorkflowRuntimeInput): Promise<boolean> {
    if (!input.workflowCode) {
      throw new RuntimeError('Workflow code is required')
    }
    if (!input.workspaceId) {
      throw new RuntimeError('Workspace ID is required')
    }

    const definition = await workflowRegistry.findByCode(input.workflowCode)
    if (!definition) {
      throw new RuntimeError('Workflow definition not found', { code: input.workflowCode })
    }

    if (definition.status !== 'active') {
      throw new RuntimeError('Workflow definition is not active', {
        code: input.workflowCode,
        status: definition.status,
      })
    }

    return true
  }

  // ─── Execute ───

  async execute(ctx: PlatformContext, input: WorkflowRuntimeInput): Promise<WorkflowRuntimeOutput> {
    if (!this.initialized) {
      await this.init(ctx, this.config)
    }

    // Merge context
    const mergedCtx: PlatformContext = {
      ...ctx,
      workflowId: input.workflowCode,
      workspaceId: input.workspaceId,
    }

    // Check if resuming from instanceId
    let instance: WorkflowInstance

    if (input.instanceId) {
      instance = await workflowService.getInstance(input.instanceId) as WorkflowInstance
      if (!instance) {
        throw new RuntimeError('Instance not found', { instanceId: input.instanceId })
      }

      // Resume execution
      await workflowService.resume(input.instanceId, mergedCtx)
    } else {
      // Create new instance
      instance = await workflowService.createInstance(
        input.workflowCode,
        input.workspaceId,
        input.input,
        mergedCtx,
      )

      if (!instance.id) {
        throw new RuntimeError('Failed to create workflow instance')
      }

      // Execute
      await workflowService.execute(instance.id, mergedCtx)
    }

    // Emit execution event
    platformEventBus.emit({
      type: 'workflow:Started' as any,
      source: 'workflow',
      timestamp: new Date().toISOString(),
      context: mergedCtx,
      entityId: instance.id,
      payload: { workflowCode: input.workflowCode, input: input.input },
    })

    return {
      instanceId: instance.id!,
      status: InstanceStatus.Running,
    }
  }

  // ─── Update ───

  async update(ctx: PlatformContext, id: string, data: Partial<WorkflowRuntimeInput>): Promise<WorkflowRuntimeOutput> {
    const instance = await workflowService.getInstance(id)
    if (!instance) {
      throw new RuntimeError('Workflow instance not found', { instanceId: id })
    }

    // Handle specific update actions
    if (data.input) {
      // Update input variables
      await workflowVariablesManager.initializeDefaultVariables(id, null, data.input)
    }

    return {
      instanceId: id,
      status: instance.status || 'unknown',
    }
  }

  // ─── Dispose ───

  async dispose(ctx: PlatformContext): Promise<void> {
    this.initialized = false

    console.log('[WorkflowRuntime] Disposed')
  }
}

// ─── Re-export InstanceStatus for convenience ───

const InstanceStatus = {
  Pending: 'pending',
  Running: 'running',
  Paused: 'paused',
  Completed: 'completed',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const

export const workflowRuntime = new WorkflowRuntime()
