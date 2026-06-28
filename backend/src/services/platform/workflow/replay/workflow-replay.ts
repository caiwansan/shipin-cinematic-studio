// ============================================================
// Workflow Replay Runtime (KMKI-PLAT-011)
// Replay, ReplayFromNode, ReplayFailedNodes, ReplayBranch
// ============================================================

import type { WorkflowContext } from '../types.js'
import { NodeStatus, InstanceStatus } from '../types.js'
import { workflowInstanceRepository } from '../repositories/instance.repository.js'
import { workflowNodeRepository } from '../repositories/node.repository.js'
import { workflowEdgeRepository } from '../repositories/edge.repository.js'
import { workflowCheckpointRepository } from '../repositories/checkpoint.repository.js'
import { workflowEventRepository } from '../repositories/event.repository.js'
import { workflowCheckpointRuntime } from '../checkpoint/workflow-checkpoint.js'
import { RuntimeError } from '@platform/errors/platform-errors'

export interface ReplayOptions {
  preserveVariables?: boolean
  preserveOutputs?: boolean
  logReplay?: boolean
}

export class WorkflowReplayRuntime {
  // ─── Full Replay ───

  async replay(instanceId: string, ctx: WorkflowContext, options: ReplayOptions = {}): Promise<void> {
    ctx.logger.info(`Starting full replay of instance ${instanceId}`)

    // Reset all nodes to pending
    await this.resetNodes(instanceId, undefined, options)

    // Reset instance
    await workflowInstanceRepository.update(instanceId, {
      status: InstanceStatus.Running,
      currentNode: null,
      error: null,
      finishedAt: null,
      startedAt: new Date(),
    })

    // Log replay event
    if (options.logReplay !== false) {
      await workflowEventRepository.create({
        instanceId,
        type: 'replayStarted',
        data: { type: 'full', timestamp: new Date().toISOString() },
      })
    }

    // Execute from scheduler
    const { workflowScheduler } = await import('../scheduler/workflow-scheduler.js')
    await workflowScheduler.executeNext(instanceId, ctx)

    ctx.logger.info(`Full replay of instance ${instanceId} completed`)
  }

  // ─── Replay From Specific Node ───

  async replayFromNode(instanceId: string, nodeId: string, ctx: WorkflowContext, options: ReplayOptions = {}): Promise<void> {
    ctx.logger.info(`Starting replay of instance ${instanceId} from node ${nodeId}`)

    // Verify the node exists
    const node = await workflowNodeRepository.findByInstanceAndNodeId(instanceId, nodeId)
    if (!node) {
      throw new RuntimeError(`Node ${nodeId} not found in instance ${instanceId}`)
    }

    // Restore from checkpoint if available
    const checkpoint = await workflowCheckpointRepository.findByInstanceAndNodeId(instanceId, nodeId)
    if (checkpoint) {
      await workflowCheckpointRuntime.restoreFromCheckpoint(instanceId, nodeId)
    }

    // Reset nodes from this point forward
    await this.resetNodesFrom(instanceId, nodeId, options)

    // Restore instance to running
    await workflowInstanceRepository.update(instanceId, {
      status: InstanceStatus.Running,
      currentNode: nodeId,
      error: null,
      finishedAt: null,
    })

    // Log replay event
    if (options.logReplay !== false) {
      await workflowEventRepository.create({
        instanceId,
        type: 'replayFromNode',
        data: { nodeId, timestamp: new Date().toISOString() },
      })
    }

    // Execute from scheduler
    const { workflowScheduler } = await import('../scheduler/workflow-scheduler.js')
    await workflowScheduler.executeNext(instanceId, ctx)
  }

  // ─── Replay Failed Nodes Only ───

  async replayFailedNodes(instanceId: string, ctx: WorkflowContext, options: ReplayOptions = {}): Promise<void> {
    ctx.logger.info(`Starting replay of failed nodes for instance ${instanceId}`)

    const failedNodes = await workflowNodeRepository.findByStatus(instanceId, NodeStatus.Failed)

    if (failedNodes.length === 0) {
      ctx.logger.info(`No failed nodes found in instance ${instanceId}`)
      return
    }

    // Reset only the failed nodes
    for (const node of failedNodes) {
      if (node.id) {
        await workflowNodeRepository.update(node.id, {
          status: NodeStatus.Pending,
          error: null,
          output: null,
          retryCount: 0,
        })
      }
    }

    // Update instance to running
    await workflowInstanceRepository.update(instanceId, {
      status: InstanceStatus.Running,
      error: null,
    })

    // Log replay event
    if (options.logReplay !== false) {
      await workflowEventRepository.create({
        instanceId,
        type: 'replayFailedNodes',
        data: {
          nodeIds: failedNodes.map(n => n.nodeId),
          timestamp: new Date().toISOString(),
        },
      })
    }

    // Execute from scheduler
    const { workflowScheduler } = await import('../scheduler/workflow-scheduler.js')
    await workflowScheduler.executeNext(instanceId, ctx)

    ctx.logger.info(`Replay of ${failedNodes.length} failed nodes completed`)
  }

  // ─── Replay Branch ───

  async replayBranch(
    instanceId: string,
    startNodeId: string,
    endNodeId: string,
    ctx: WorkflowContext,
    options: ReplayOptions = {},
  ): Promise<void> {
    ctx.logger.info(`Starting branch replay of instance ${instanceId} from ${startNodeId} to ${endNodeId}`)

    // Get all edges
    const edges = await workflowEdgeRepository.findByInstance(instanceId)
    const nodes = await workflowNodeRepository.findByInstance(instanceId)

    // Find all nodes in the branch path
    const branchNodes = this.findBranchPath(startNodeId, endNodeId, edges)
    branchNodes.add(startNodeId)
    branchNodes.add(endNodeId)

    // Reset only branch nodes
    for (const node of nodes) {
      if (branchNodes.has(node.nodeId) && node.id) {
        await workflowNodeRepository.update(node.id, {
          status: NodeStatus.Pending,
          error: null,
          output: null,
          retryCount: 0,
        })
      }
    }

    // Update instance
    await workflowInstanceRepository.update(instanceId, {
      status: InstanceStatus.Running,
      currentNode: startNodeId,
      error: null,
    })

    // Log replay event
    if (options.logReplay !== false) {
      await workflowEventRepository.create({
        instanceId,
        type: 'replayBranch',
        data: {
          startNodeId,
          endNodeId,
          branchNodes: Array.from(branchNodes),
          timestamp: new Date().toISOString(),
        },
      })
    }

    // Execute from scheduler
    const { workflowScheduler } = await import('../scheduler/workflow-scheduler.js')
    await workflowScheduler.executeNext(instanceId, ctx)

    ctx.logger.info(`Branch replay from ${startNodeId} to ${endNodeId} completed`)
  }

  // ─── Private Helpers ───

  private async resetNodes(
    instanceId: string,
    exceptNodeId?: string,
    _options: ReplayOptions = {},
  ): Promise<void> {
    const nodes = await workflowNodeRepository.findByInstance(instanceId)

    for (const node of nodes) {
      if (node.nodeId !== exceptNodeId && node.id) {
        await workflowNodeRepository.update(node.id, {
          status: NodeStatus.Pending,
          error: null,
          output: null,
          retryCount: 0,
          startedAt: null,
          completedAt: null,
        })
      }
    }
  }

  private async resetNodesFrom(
    instanceId: string,
    fromNodeId: string,
    _options: ReplayOptions = {},
  ): Promise<void> {
    const edges = await workflowEdgeRepository.findByInstance(instanceId)
    const nodes = await workflowNodeRepository.findByInstance(instanceId)

    // Find all nodes reachable from fromNodeId
    const affectedNodes = this.findDownstreamNodes(fromNodeId, edges)
    affectedNodes.add(fromNodeId)

    // Also find upstream nodes that were skipped
    const upstreamSkipped = new Set<string>()

    for (const node of nodes) {
      if (node.status === NodeStatus.Skipped && affectedNodes.has(node.nodeId)) {
        upstreamSkipped.add(node.nodeId)
      }
    }

    const allAffected = new Set([...affectedNodes, ...upstreamSkipped])

    for (const node of nodes) {
      if (allAffected.has(node.nodeId) && node.id) {
        await workflowNodeRepository.update(node.id, {
          status: NodeStatus.Pending,
          error: null,
          output: null,
          retryCount: 0,
          startedAt: null,
          completedAt: null,
        })
      }
    }
  }

  private findDownstreamNodes(nodeId: string, edges: any[]): Set<string> {
    const downstream = new Set<string>()
    const stack = [nodeId]

    while (stack.length > 0) {
      const current = stack.pop()!
      const outgoing = edges.filter(e => e.sourceNodeId === current)

      for (const edge of outgoing) {
        if (!downstream.has(edge.targetNodeId)) {
          downstream.add(edge.targetNodeId)
          stack.push(edge.targetNodeId)
        }
      }
    }

    return downstream
  }

  private findBranchPath(startNodeId: string, endNodeId: string, edges: any[]): Set<string> {
    // Simple BFS to find the shortest path
    const visited = new Set<string>()
    const queue: string[][] = [[startNodeId]]

    while (queue.length > 0) {
      const path = queue.shift()!
      const current = path[path.length - 1]

      if (current === endNodeId) {
        return new Set(path)
      }

      if (visited.has(current)) continue
      visited.add(current)

      const outgoing = edges.filter(e => e.sourceNodeId === current)
      for (const edge of outgoing) {
        if (!visited.has(edge.targetNodeId)) {
          queue.push([...path, edge.targetNodeId])
        }
      }
    }

    return new Set([startNodeId, endNodeId])
  }
}

export const workflowReplayRuntime = new WorkflowReplayRuntime()
