// ============================================================
// Workflow Scheduler (KMKI-PLAT-011)
// Orchestrates node-level execution in a workflow
// Independent of Agent Scheduler — this schedules Nodes, not Agents
// ============================================================

import type { WorkflowInstance, WorkflowContext, NodeExecutionResult } from '../types.js'
import { InstanceStatus, NodeStatus } from '../types.js'
import { workflowInstanceRepository } from '../repositories/instance.repository.js'
import { workflowNodeRepository } from '../repositories/node.repository.js'
import { workflowEdgeRepository } from '../repositories/edge.repository.js'
import { workflowEventRepository } from '../repositories/event.repository.js'
import { workflowCheckpointRepository } from '../repositories/checkpoint.repository.js'
import { getNextNodes } from '../graph/workflow-graph.js'
import { RuntimeError } from '@platform/errors/platform-errors'
import { PlatformContext } from '@platform/context/platform-context'
import { platformEventBus } from '@platform/events/event-bus'

export interface SchedulerOptions {
  maxRetries?: number
  retryDelayMs?: number
  timeoutMs?: number
  concurrency?: number
}

const DEFAULT_OPTIONS: SchedulerOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 300000, // 5 min default
  concurrency: 5,
}

export class WorkflowScheduler {
  private options: SchedulerOptions
  private runningInstances: Map<string, boolean> = new Map()

  constructor(options: SchedulerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // ─── Execute next ready node(s) ───

  async executeNext(instanceId: string, ctx: WorkflowContext): Promise<void> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    if (!instance || !instance.id) {
      throw new RuntimeError('Instance not found', { instanceId })
    }

    if (instance.status !== 'running') {
      ctx.logger.warn(`Instance ${instanceId} is not running (status: ${instance.status}), skipping`)
      return
    }

    const nodes = await workflowNodeRepository.findByInstance(instanceId)
    const edges = await workflowEdgeRepository.findByInstance(instanceId)

    // Find ready nodes: all dependencies completed, and pending
    const readyNodes = nodes.filter(node => {
      if (node.status !== NodeStatus.Pending && node.status !== NodeStatus.Skipped) return false

      // Check all incoming edges have completed source nodes
      const incomingEdges = edges.filter(e => e.targetNodeId === node.nodeId)
      if (incomingEdges.length === 0) return true // Entry node

      return incomingEdges.every(edge => {
        const sourceNode = nodes.find(n => n.nodeId === edge.sourceNodeId)
        return sourceNode?.status === NodeStatus.Completed || sourceNode?.status === NodeStatus.Skipped
      })
    })

    if (readyNodes.length === 0) {
      // Check if all nodes completed
      const allCompleted = nodes.every(n =>
        n.status === NodeStatus.Completed || n.status === NodeStatus.Skipped || n.nodeId === 'end'
      )
      if (allCompleted) {
        await this.finalizeInstance(instanceId, ctx)
      }
      return
    }

    // Execute ready nodes (with concurrency limit)
    const maxConcurrent = this.options.concurrency || 5
    const batch = readyNodes.slice(0, maxConcurrent)

    await Promise.all(
      batch.map(node => this.executeNode(node.id!, ctx))
    )

    // Recurse to find next batch
    await this.executeNext(instanceId, ctx)
  }

  // ─── Execute single node ───

  async executeNode(nodeRecordId: string, ctx: WorkflowContext): Promise<NodeExecutionResult> {
    const node = await workflowNodeRepository.findById(nodeRecordId)
    if (!node || !node.id) {
      throw new RuntimeError('Node not found', { nodeRecordId })
    }

    // Mark as running
    await workflowNodeRepository.updateNodeStatus(node.id, NodeStatus.Running)

    // Emit node started event
    await this.emitNodeEvent(ctx.instanceId, node.nodeId, 'nodeStarted', { nodeType: node.type })

    const result: NodeExecutionResult = { success: false }

    try {
      // Execute based on node type
      const startTime = Date.now()
      result.output = await this.dispatchNodeExecution(node, ctx)
      result.latencyMs = Date.now() - startTime

      // Mark as completed
      await workflowNodeRepository.update(node.id, {
        output: result.output,
        status: NodeStatus.Completed,
        completedAt: new Date(),
      })

      result.success = true

      // Save checkpoint
      await this.saveCheckpoint(ctx.instanceId, node.nodeId)

      // Emit node completed event
      await this.emitNodeEvent(ctx.instanceId, node.nodeId, 'nodeCompleted', {
        output: result.output,
        latencyMs: result.latencyMs,
      })

      // Update instance currentNode
      await workflowInstanceRepository.update(ctx.instanceId, { currentNode: node.nodeId })
    } catch (err: any) {
      result.error = err.message

      // Check retry
      if (node.retryCount < (this.options.maxRetries || 3)) {
        ctx.logger.warn(`Node ${node.nodeId} failed (attempt ${node.retryCount + 1}): ${err.message}. Retrying...`)

        await workflowNodeRepository.incrementRetry(node.id)

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs || 1000))

        // Retry
        return this.executeNode(nodeRecordId, ctx)
      }

      // Max retries exceeded — mark as failed
      await workflowNodeRepository.update(node.id, {
        error: result.error,
        status: NodeStatus.Failed,
        completedAt: new Date(),
      })

      // Emit node failed event
      await this.emitNodeEvent(ctx.instanceId, node.nodeId, 'nodeFailed', { error: result.error })

      // Handle node failure based on type
      await this.handleNodeFailure(node, ctx)
    }

    return result
  }

  // ─── Parallel execution ───

  async executeParallel(nodeIds: string[], ctx: WorkflowContext): Promise<NodeExecutionResult[]> {
    return Promise.all(
      nodeIds.map(nodeId => this.executeNode(nodeId, ctx))
    )
  }

  // ─── Retry node ───

  async retryNode(nodeId: string, ctx: WorkflowContext): Promise<NodeExecutionResult> {
    const node = await workflowNodeRepository.findByInstanceAndNodeId(ctx.instanceId, nodeId)
    if (!node || !node.id) {
      throw new RuntimeError('Node not found', { instanceId: ctx.instanceId, nodeId })
    }

    // Reset node status
    await workflowNodeRepository.update(node.id, {
      status: NodeStatus.Pending,
      error: null,
      output: null,
    })

    return this.executeNode(node.id, ctx)
  }

  // ─── Resume instance from checkpoint ───

  async resume(instanceId: string, ctx: WorkflowContext): Promise<void> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    if (!instance || !instance.id) {
      throw new RuntimeError('Instance not found', { instanceId })
    }

    // Check last checkpoint
    const lastCheckpoint = await workflowCheckpointRepository.getLatestByInstance(instanceId)
    const resumeNodeId = lastCheckpoint?.nodeId || null

    ctx.logger.info(`Resuming instance ${instanceId} from node ${resumeNodeId || 'start'}`)

    // Update status to running
    await workflowInstanceRepository.updateStatus(instanceId, InstanceStatus.Running)
    if (resumeNodeId) {
      await workflowInstanceRepository.update(instanceId, { currentNode: resumeNodeId })
    }

    // Emit resumed event
    await this.emitInstanceEvent(instanceId, 'resumed', { resumeNodeId })

    // Continue execution
    await this.executeNext(instanceId, ctx)
  }

  // ─── Cancel instance ───

  async cancel(instanceId: string, ctx: WorkflowContext): Promise<void> {
    await workflowInstanceRepository.updateStatus(instanceId, InstanceStatus.Cancelled)

    const nodes = await workflowNodeRepository.findByInstance(instanceId)
    for (const node of nodes) {
      if (node.status === NodeStatus.Running || node.status === NodeStatus.Pending) {
        if (node.id) {
          await workflowNodeRepository.updateNodeStatus(node.id, NodeStatus.Skipped)
        }
      }
    }

    await this.emitInstanceEvent(instanceId, 'cancelled', {})
    ctx.logger.info(`Instance ${instanceId} cancelled`)
  }

  // ─── Private Helpers ───

  private async dispatchNodeExecution(node: any, ctx: WorkflowContext): Promise<any> {
    const type = node.type

    switch (type) {
      case 'start':
        return { status: 'started', timestamp: new Date().toISOString() }

      case 'end':
        return { status: 'finished', timestamp: new Date().toISOString() }

      case 'agent':
        if (!ctx.agentDispatcher) throw new RuntimeError('Agent dispatcher not available')
        return ctx.agentDispatcher.execute(node.nodeId, { input: node.input, config: node.config }, { workspaceId: ctx.workspaceId })

      case 'capability':
        if (!ctx.capabilityResolver) throw new RuntimeError('Capability resolver not available')
        return ctx.capabilityResolver.resolve(node.name, { input: node.input, config: node.config }, { workspaceId: ctx.workspaceId })

      case 'delay':
        return this.executeDelayNode(node)

      case 'condition':
        // Condition nodes are resolved by the graph engine; just pass through
        return { evaluated: true, type: 'condition' }

      case 'parallel':
        return { type: 'parallel', status: 'dispatched' }

      case 'loop':
        return { type: 'loop', status: 'active' }

      case 'merge':
        return { type: 'merge', status: 'merged' }

      case 'event':
        return this.executeEventNode(node, ctx)

      case 'humanApproval':
      case 'humanEdit':
      case 'humanReview':
      case 'humanUpload':
      case 'humanDecision':
        return { type: 'human', status: 'pending', humanType: type }

      default:
        throw new RuntimeError(`Unknown node type: ${type}`)
    }
  }

  private async executeDelayNode(node: any): Promise<any> {
    const config = typeof node.config === 'object' ? node.config : JSON.parse(node.config || '{}')
    const delayMs = config.duration || config.delayMs || 1000
    await new Promise(resolve => setTimeout(resolve, delayMs))
    return { status: 'completed', delayMs }
  }

  private async executeEventNode(node: any, ctx: WorkflowContext): Promise<any> {
    const config = typeof node.config === 'object' ? node.config : JSON.parse(node.config || '{}')
    const eventType = config.eventType || config.event
    if (eventType) {
      platformEventBus.emit({
        type: 'workflow:Custom' as any,
        source: 'workflow',
        timestamp: new Date().toISOString(),
        context: { workflowId: ctx.workflowId, workspaceId: ctx.workspaceId },
        payload: { eventType, nodeId: node.nodeId, config },
      })
    }
    return { status: 'emitted', eventType }
  }

  private async handleNodeFailure(node: any, ctx: WorkflowContext): Promise<void> {
    // For critical node types, fail the entire workflow
    const criticalTypes = ['agent', 'capability', 'condition']
    if (criticalTypes.includes(node.type)) {
      ctx.logger.error(`Critical node ${node.nodeId} (${node.type}) failed. Failing workflow.`)
      const instanceId = node.instanceId
      await workflowInstanceRepository.updateStatus(instanceId, InstanceStatus.Failed, node.error)
      await this.emitInstanceEvent(instanceId, 'workflowFailed', { failedNode: node.nodeId, error: node.error })
    }
  }

  private async saveCheckpoint(instanceId: string, nodeId: string): Promise<void> {
    const nodeRecord = await workflowNodeRepository.findByInstanceAndNodeId(instanceId, nodeId)
    if (!nodeRecord) return

    await workflowCheckpointRepository.create({
      instanceId,
      nodeId,
      snapshot: {
        nodeId,
        nodeStatus: nodeRecord.status,
        timestamp: new Date().toISOString(),
      },
    })
  }

  private async finalizeInstance(instanceId: string, ctx: WorkflowContext): Promise<void> {
    const nodes = await workflowNodeRepository.findByInstance(instanceId)

    // Calculate total cost
    let totalCost = 0
    for (const node of nodes) {
      if (node.metadata) {
        try {
          const meta = typeof node.metadata === 'object' ? node.metadata : JSON.parse(node.metadata)
          if (meta.cost) totalCost += parseFloat(meta.cost) || 0
        } catch {}
      }
    }

    await workflowInstanceRepository.update(instanceId, {
      status: InstanceStatus.Completed,
      cost: totalCost,
      finishedAt: new Date(),
    })

    await this.emitInstanceEvent(instanceId, 'workflowFinished', { cost: totalCost })
    ctx.logger.info(`Instance ${instanceId} completed successfully`)
  }

  private async emitNodeEvent(instanceId: string, nodeId: string, type: string, data?: any): Promise<void> {
    await workflowEventRepository.create({
      instanceId,
      type,
      nodeId,
      data: data || {},
      timestamp: new Date(),
    })

    // Also emit to platform event bus
    platformEventBus.emit({
      type: `workflow:${type.charAt(0).toUpperCase() + type.slice(1)}` as any,
      source: 'workflow',
      timestamp: new Date().toISOString(),
      entityId: instanceId,
      payload: { nodeId, ...data },
    })
  }

  private async emitInstanceEvent(instanceId: string, type: string, data?: any): Promise<void> {
    await workflowEventRepository.create({
      instanceId,
      type,
      data: data || {},
      timestamp: new Date(),
    })

    platformEventBus.emit({
      type: `workflow:${type.charAt(0).toUpperCase() + type.slice(1)}` as any,
      source: 'workflow',
      timestamp: new Date().toISOString(),
      entityId: instanceId,
      payload: data,
    })
  }
}

export const workflowScheduler = new WorkflowScheduler()
