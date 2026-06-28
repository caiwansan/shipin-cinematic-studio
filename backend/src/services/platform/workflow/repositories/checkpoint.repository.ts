// ============================================================
// WorkflowCheckpoint Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowCheckpoint } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowCheckpointRepository {
  async create(data: WorkflowCheckpoint): Promise<WorkflowCheckpoint> {
    try {
      const snapshot = typeof data.snapshot === 'object' ? JSON.stringify(data.snapshot) : data.snapshot
      const variables = data.variables ? (typeof data.variables === 'object' ? JSON.stringify(data.variables) : data.variables) : null
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowCheckpoint.create({
        data: {
          instanceId: data.instanceId,
          nodeId: data.nodeId,
          snapshot,
          variables,
          metadata,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow checkpoint', { error: err.message })
    }
  }

  async findById(id: string): Promise<WorkflowCheckpoint | null> {
    try {
      const record = await prisma.workflowCheckpoint.findUnique({ where: { id } })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow checkpoint', { id, error: err.message })
    }
  }

  async findByInstance(instanceId: string): Promise<WorkflowCheckpoint[]> {
    try {
      const records = await prisma.workflowCheckpoint.findMany({
        where: { instanceId },
        orderBy: { createdAt: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow checkpoints by instance', { instanceId, error: err.message })
    }
  }

  async findByInstanceAndNodeId(instanceId: string, nodeId: string): Promise<WorkflowCheckpoint | null> {
    try {
      const record = await prisma.workflowCheckpoint.findUnique({
        where: { instanceId_nodeId: { instanceId, nodeId } },
      })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow checkpoint by instance and nodeId', { instanceId, nodeId, error: err.message })
    }
  }

  async getLatestByInstance(instanceId: string): Promise<WorkflowCheckpoint | null> {
    try {
      const record = await prisma.workflowCheckpoint.findFirst({
        where: { instanceId },
        orderBy: { createdAt: 'desc' },
      })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find latest workflow checkpoint', { instanceId, error: err.message })
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.workflowCheckpoint.delete({ where: { id } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow checkpoint', { id, error: err.message })
    }
  }

  async deleteByInstance(instanceId: string): Promise<void> {
    try {
      await prisma.workflowCheckpoint.deleteMany({ where: { instanceId } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow checkpoints by instance', { instanceId, error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowCheckpoint {
    return {
      id: record.id,
      instanceId: record.instanceId,
      nodeId: record.nodeId,
      snapshot: record.snapshot,
      variables: record.variables,
      metadata: record.metadata,
      createdAt: record.createdAt,
    }
  }
}

export const workflowCheckpointRepository = new WorkflowCheckpointRepository()
