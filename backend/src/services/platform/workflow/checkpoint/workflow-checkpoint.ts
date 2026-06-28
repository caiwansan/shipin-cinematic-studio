// ============================================================
// Workflow Checkpoint Runtime (KMKI-PLAT-011)
// Automatic checkpointing for crash recovery
// ============================================================

import { workflowCheckpointRepository } from '../repositories/checkpoint.repository.js'
import { workflowInstanceRepository } from '../repositories/instance.repository.js'
import { workflowNodeRepository } from '../repositories/node.repository.js'
import { workflowVariableRepository } from '../repositories/variable.repository.js'
import { RuntimeError } from '@platform/errors/platform-errors'
import type { WorkflowCheckpoint } from '../types.js'

export interface CheckpointSnapshot {
  instanceId: string
  nodeId: string
  instanceStatus: string
  currentNode: string | null
  nodeStatuses: Record<string, string>
  variables: Record<string, any>
  timestamp: string
}

export class WorkflowCheckpointRuntime {
  // ─── Save Checkpoint ───

  async saveCheckpoint(
    instanceId: string,
    nodeId: string,
    snapshot?: Record<string, any>,
    variables?: Record<string, any>,
  ): Promise<WorkflowCheckpoint> {
    // Build snapshot from current state if not provided
    if (!snapshot) {
      snapshot = await this.buildSnapshot(instanceId, nodeId)
    }

    // Get variables if not provided
    if (!variables) {
      const varRecords = await workflowVariableRepository.findByInstance(instanceId)
      variables = {}
      for (const vr of varRecords) {
        if (!variables[vr.scope]) variables[vr.scope] = {}
        try {
          variables[vr.scope][vr.name] = JSON.parse(vr.value as string)
        } catch {
          variables[vr.scope][vr.name] = vr.value
        }
      }
    }

    const checkpoint = await workflowCheckpointRepository.create({
      instanceId,
      nodeId,
      snapshot,
      variables,
      metadata: {
        timestamp: new Date().toISOString(),
        nodeId,
      },
    })

    return checkpoint
  }

  // ─── Restore from Checkpoint ───

  async restoreFromCheckpoint(instanceId: string, nodeId: string): Promise<CheckpointSnapshot | null> {
    const checkpoint = await workflowCheckpointRepository.findByInstanceAndNodeId(instanceId, nodeId)
    if (!checkpoint) return null

    const snapshot = typeof checkpoint.snapshot === 'object'
      ? checkpoint.snapshot as any
      : JSON.parse(checkpoint.snapshot)

    // Restore instance status
    if (snapshot.instanceStatus) {
      await workflowInstanceRepository.update(instanceId, {
        status: snapshot.instanceStatus,
        currentNode: snapshot.currentNode || nodeId,
      })
    }

    // Restore node statuses
    if (snapshot.nodeStatuses) {
      const nodes = await workflowNodeRepository.findByInstance(instanceId)
      for (const node of nodes) {
        const restoredStatus = snapshot.nodeStatuses[node.nodeId]
        if (restoredStatus && node.id) {
          await workflowNodeRepository.updateNodeStatus(node.id, restoredStatus)
        }
      }
    }

    // Restore variables
    if (checkpoint.variables) {
      const vars = typeof checkpoint.variables === 'object'
        ? checkpoint.variables as any
        : JSON.parse(checkpoint.variables)

      for (const [scope, scopeVars] of Object.entries(vars)) {
        for (const [name, value] of Object.entries(scopeVars as any)) {
          await workflowVariableRepository.upsert({
            instanceId,
            scope,
            name,
            value: JSON.stringify(value),
          })
        }
      }
    }

    return {
      instanceId,
      nodeId,
      instanceStatus: snapshot.instanceStatus || 'unknown',
      currentNode: snapshot.currentNode || null,
      nodeStatuses: snapshot.nodeStatuses || {},
      variables: checkpoint.variables ? (typeof checkpoint.variables === 'object' ? checkpoint.variables : JSON.parse(checkpoint.variables)) : {},
      timestamp: snapshot.timestamp || new Date().toISOString(),
    }
  }

  // ─── List Checkpoints ───

  async listCheckpoints(instanceId: string): Promise<WorkflowCheckpoint[]> {
    return workflowCheckpointRepository.findByInstance(instanceId)
  }

  // ─── Get Latest Checkpoint ───

  async getLatestCheckpoint(instanceId: string): Promise<WorkflowCheckpoint | null> {
    return workflowCheckpointRepository.getLatestByInstance(instanceId)
  }

  // ─── Clear Checkpoints ───

  async clearCheckpoints(instanceId: string): Promise<void> {
    await workflowCheckpointRepository.deleteByInstance(instanceId)
  }

  // ─── Check if checkpoint exists for node ───

  async hasCheckpoint(instanceId: string, nodeId: string): Promise<boolean> {
    const cp = await workflowCheckpointRepository.findByInstanceAndNodeId(instanceId, nodeId)
    return cp !== null
  }

  // ─── Auto-save checkpoint for key nodes ───

  async autoCheckpoint(instanceId: string, nodeId: string): Promise<void> {
    const criticalTypes = ['agent', 'capability', 'condition', 'humanApproval', 'humanEdit', 'humanReview', 'humanUpload', 'humanDecision']
    // For now, save checkpoint for every completed node
    await this.saveCheckpoint(instanceId, nodeId)
  }

  // ─── Private: Build snapshot from current state ───

  private async buildSnapshot(instanceId: string, nodeId: string): Promise<Record<string, any>> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    const nodes = await workflowNodeRepository.findByInstance(instanceId)

    const nodeStatuses: Record<string, string> = {}
    for (const node of nodes) {
      nodeStatuses[node.nodeId] = node.status || 'pending'
    }

    return {
      instanceId,
      nodeId,
      instanceStatus: instance?.status || 'unknown',
      currentNode: instance?.currentNode || null,
      nodeStatuses,
      timestamp: new Date().toISOString(),
    }
  }
}

export const workflowCheckpointRuntime = new WorkflowCheckpointRuntime()
