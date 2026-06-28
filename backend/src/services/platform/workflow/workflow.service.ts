// ============================================================
// Workflow Service (KMKI-PLAT-011)
// Business orchestration for Workflow Runtime
// ============================================================

import type { WorkflowDefinition, WorkflowInstance, WorkflowContext } from './types.js'
import { InstanceStatus } from './types.js'
import { workflowDefinitionRepository } from './repositories/definition.repository.js'
import { workflowInstanceRepository } from './repositories/instance.repository.js'
import { workflowNodeRepository } from './repositories/node.repository.js'
import { workflowEdgeRepository } from './repositories/edge.repository.js'
import { workflowEventRepository } from './repositories/event.repository.js'
import { workflowCheckpointRepository } from './repositories/checkpoint.repository.js'
import { workflowTemplateRepository } from './repositories/template.repository.js'
import { workflowRegistry } from './registry/workflow-registry.js'
import { workflowContextFactory } from './context/workflow-context.js'
import { workflowVariablesManager } from './variables/workflow-variables.js'
import { workflowCheckpointRuntime } from './checkpoint/workflow-checkpoint.js'
import { workflowReplayRuntime } from './replay/workflow-replay.js'
import { workflowScheduler } from './scheduler/workflow-scheduler.js'
import { humanResponseHandler } from './human/human-nodes.js'
import { parseGraph, validateGraph } from './graph/workflow-graph.js'
import { RuntimeError, NotFoundError, ValidationError } from '@platform/errors/platform-errors'
import type { PlatformContext } from '@platform/context/platform-context'
import { platformEventBus } from '@platform/events/event-bus'

export class WorkflowService {
  // ─── Create Workflow Definition ───

  async createDefinition(data: WorkflowDefinition): Promise<WorkflowDefinition> {
    // Validate
    const validation = await workflowRegistry.validateDefinition(data)
    if (!validation.valid) {
      throw new ValidationError('Invalid workflow definition', { errors: validation.errors })
    }

    return workflowRegistry.register(data)
  }

  // ─── Get Definition ───

  async getDefinition(idOrCode: string): Promise<WorkflowDefinition | null> {
    let def = await workflowDefinitionRepository.findById(idOrCode)
    if (!def) {
      def = await workflowDefinitionRepository.findByCode(idOrCode)
    }
    return def
  }

  // ─── List Definitions ───

  async listDefinitions(filter?: { status?: string; category?: string }): Promise<WorkflowDefinition[]> {
    return workflowDefinitionRepository.list(filter)
  }

  // ─── Update Definition ───

  async updateDefinition(id: string, data: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    const existing = await workflowDefinitionRepository.findById(id)
    if (!existing) {
      throw new NotFoundError('Workflow definition not found', { id })
    }
    return workflowDefinitionRepository.update(id, data)
  }

  // ─── Delete Definition ───

  async deleteDefinition(id: string): Promise<void> {
    const existing = await workflowDefinitionRepository.findById(id)
    if (!existing) {
      throw new NotFoundError('Workflow definition not found', { id })
    }
    await workflowDefinitionRepository.delete(id)
  }

  // ─── Create Instance ───

  async createInstance(
    workflowCode: string,
    workspaceId: string,
    input?: Record<string, any>,
    platformCtx?: PlatformContext,
  ): Promise<WorkflowInstance> {
    const definition = await workflowDefinitionRepository.findByCode(workflowCode)
    if (!definition || !definition.id) {
      throw new NotFoundError('Workflow definition not found', { code: workflowCode })
    }

    if (definition.status !== 'active') {
      throw new ValidationError('Workflow definition is not active', {
        code: workflowCode,
        status: definition.status,
      })
    }

    // Parse graph
    const { nodes, edges } = parseGraph(definition)

    // Create instance
    const instance = await workflowInstanceRepository.create({
      workflowId: definition.id,
      workspaceId,
      status: InstanceStatus.Pending,
      input: input || {},
    })

    if (!instance.id) {
      throw new RuntimeError('Failed to create workflow instance')
    }

    // Create nodes
    const dagNodes = nodes.map(node => ({
      instanceId: instance.id!,
      nodeId: node.id,
      type: node.type,
      name: node.name,
      config: node.config || {},
      status: 'pending',
    }))
    await workflowNodeRepository.bulkCreate(dagNodes)

    // Create edges
    const dagEdges = edges.map(edge => ({
      instanceId: instance.id!,
      edgeId: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      condition: edge.condition || null,
      label: edge.label || null,
    }))
    await workflowEdgeRepository.bulkCreate(dagEdges)

    // Initialize variables
    await workflowVariablesManager.initializeDefaultVariables(instance.id, definition.variables, input)

    // Log creation event
    await workflowEventRepository.create({
      instanceId: instance.id,
      type: 'workflowCreated',
      data: {
        workflowCode,
        workflowName: definition.name,
        input: input || {},
      },
    })

    return instance
  }

  // ─── Execute Workflow ───

  async execute(
    instanceId: string,
    platformCtx?: PlatformContext,
  ): Promise<WorkflowInstance> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    if (!instance || !instance.id) {
      throw new NotFoundError('Workflow instance not found', { instanceId })
    }

    // Build context
    const ctx = await workflowContextFactory.buildContext(instanceId, platformCtx)

    // Update instance status
    await workflowInstanceRepository.updateStatus(instanceId, InstanceStatus.Running)

    // Emit started event
    await workflowEventRepository.create({
      instanceId,
      type: 'workflowStarted',
      data: { timestamp: new Date().toISOString() },
    })

    platformEventBus.emit({
      type: 'workflow:Started' as any,
      source: 'workflow',
      timestamp: new Date().toISOString(),
      context: platformCtx,
      entityId: instanceId,
    })

    // Start scheduler
    // Execute async — don't await for long-running workflows
    setImmediate(async () => {
      try {
        await workflowScheduler.executeNext(instanceId, ctx)
      } catch (err: any) {
        ctx.logger.error(`Workflow execution failed: ${err.message}`)
        await workflowInstanceRepository.updateStatus(instanceId, InstanceStatus.Failed, err.message)
      }
    })

    // Return updated instance
    return workflowInstanceRepository.findById(instanceId) as Promise<WorkflowInstance>
  }

  // ─── Pause Workflow ───

  async pause(instanceId: string): Promise<WorkflowInstance> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    if (!instance) {
      throw new NotFoundError('Workflow instance not found', { instanceId })
    }

    await workflowInstanceRepository.updateStatus(instanceId, InstanceStatus.Paused)

    await workflowEventRepository.create({
      instanceId,
      type: 'paused',
      data: { timestamp: new Date().toISOString() },
    })

    platformEventBus.emit({
      type: 'workflow:Paused' as any,
      source: 'workflow',
      timestamp: new Date().toISOString(),
      entityId: instanceId,
    })

    return workflowInstanceRepository.findById(instanceId) as Promise<WorkflowInstance>
  }

  // ─── Resume Workflow ───

  async resume(instanceId: string, platformCtx?: PlatformContext): Promise<WorkflowInstance> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    if (!instance) {
      throw new NotFoundError('Workflow instance not found', { instanceId })
    }

    const ctx = await workflowContextFactory.buildContext(instanceId, platformCtx)
    await workflowScheduler.resume(instanceId, ctx)

    return workflowInstanceRepository.findById(instanceId) as Promise<WorkflowInstance>
  }

  // ─── Cancel Workflow ───

  async cancel(instanceId: string): Promise<WorkflowInstance> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    if (!instance) {
      throw new NotFoundError('Workflow instance not found', { instanceId })
    }

    const ctx = await workflowContextFactory.buildContext(instanceId)
    await workflowScheduler.cancel(instanceId, ctx)

    return workflowInstanceRepository.findById(instanceId) as Promise<WorkflowInstance>
  }

  // ─── Replay Workflow ───

  async replay(
    instanceId: string,
    options?: { fromNode?: string; failedOnly?: boolean; branch?: { start: string; end: string } },
    platformCtx?: PlatformContext,
  ): Promise<WorkflowInstance> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    if (!instance) {
      throw new NotFoundError('Workflow instance not found', { instanceId })
    }

    const ctx = await workflowContextFactory.buildContext(instanceId, platformCtx)

    if (options?.fromNode) {
      await workflowReplayRuntime.replayFromNode(instanceId, options.fromNode, ctx)
    } else if (options?.failedOnly) {
      await workflowReplayRuntime.replayFailedNodes(instanceId, ctx)
    } else if (options?.branch) {
      await workflowReplayRuntime.replayBranch(instanceId, options.branch.start, options.branch.end, ctx)
    } else {
      await workflowReplayRuntime.replay(instanceId, ctx)
    }

    return workflowInstanceRepository.findById(instanceId) as Promise<WorkflowInstance>
  }

  // ─── List Instances ───

  async listInstances(filter?: {
    workflowId?: string
    workspaceId?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<WorkflowInstance[]> {
    if (filter?.workflowId) {
      return workflowInstanceRepository.findByWorkflow(filter.workflowId, filter.limit, filter.offset)
    }
    if (filter?.workspaceId) {
      return workflowInstanceRepository.findByWorkspace(filter.workspaceId, filter.limit, filter.offset)
    }
    if (filter?.status) {
      return workflowInstanceRepository.findByStatus(filter.status, filter.limit)
    }
    return workflowInstanceRepository.findByStatus(InstanceStatus.Running, 20)
  }

  // ─── Get Instance ───

  async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    return workflowInstanceRepository.findById(instanceId)
  }

  // ─── Get Instance Detail (with nodes, edges, events) ───

  async describeInstance(instanceId: string): Promise<{
    instance: WorkflowInstance | null
    nodes: any[]
    edges: any[]
    events: any[]
    checkpoints: any[]
  }> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    const nodes = await workflowNodeRepository.findByInstance(instanceId)
    const edges = await workflowEdgeRepository.findByInstance(instanceId)
    const events = await workflowEventRepository.findByInstance(instanceId, 100)
    const checkpoints = await workflowCheckpointRepository.findByInstance(instanceId)

    return { instance, nodes, edges, events, checkpoints }
  }

  // ─── Checkpoint Operations ───

  async saveCheckpoint(instanceId: string, nodeId: string): Promise<any> {
    return workflowCheckpointRuntime.saveCheckpoint(instanceId, nodeId)
  }

  async listCheckpoints(instanceId: string): Promise<any[]> {
    return workflowCheckpointRepository.findByInstance(instanceId)
  }

  // ─── Human Response ───

  async submitHumanResponse(
    instanceId: string,
    nodeType: string,
    action: string,
    data?: Record<string, any>,
  ): Promise<void> {
    await humanResponseHandler.submitResponse(instanceId, nodeType, action, data)
  }

  // ─── Template Operations ───

  async createTemplate(data: any): Promise<any> {
    return workflowTemplateRepository.create(data)
  }

  async listTemplates(category?: string): Promise<any[]> {
    if (category) {
      return workflowTemplateRepository.listByCategory(category)
    }
    return workflowTemplateRepository.list()
  }

  // ─── Health ───

  async health(): Promise<{
    status: string
    definitionCount: number
    activeInstanceCount: number
    runningInstanceCount: number
    failedInstanceCount: number
  }> {
    const [definitions, active, running, failed] = await Promise.all([
      workflowDefinitionRepository.count(),
      workflowInstanceRepository.count({ status: InstanceStatus.Running }),
      workflowInstanceRepository.count({ status: InstanceStatus.Running }),
      workflowInstanceRepository.count({ status: InstanceStatus.Failed }),
    ])

    return {
      status: 'ok',
      definitionCount: definitions,
      activeInstanceCount: active,
      runningInstanceCount: running,
      failedInstanceCount: failed,
    }
  }
}

export const workflowService = new WorkflowService()
