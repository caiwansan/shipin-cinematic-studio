// ============================================================
// WorkflowEdge Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowEdge } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowEdgeRepository {
  async create(data: WorkflowEdge): Promise<WorkflowEdge> {
    try {
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowEdge.create({
        data: {
          instanceId: data.instanceId,
          edgeId: data.edgeId,
          sourceNodeId: data.sourceNodeId,
          targetNodeId: data.targetNodeId,
          condition: data.condition || null,
          label: data.label || null,
          metadata,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow edge', { error: err.message })
    }
  }

  async bulkCreate(edges: WorkflowEdge[]): Promise<WorkflowEdge[]> {
    try {
      const results: WorkflowEdge[] = []
      for (const edge of edges) {
        results.push(await this.create(edge))
      }
      return results
    } catch (err: any) {
      throw new RepositoryError('Failed to bulk create workflow edges', { error: err.message })
    }
  }

  async findByInstance(instanceId: string): Promise<WorkflowEdge[]> {
    try {
      const records = await prisma.workflowEdge.findMany({
        where: { instanceId },
        orderBy: { createdAt: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow edges by instance', { instanceId, error: err.message })
    }
  }

  async findBySource(instanceId: string, sourceNodeId: string): Promise<WorkflowEdge[]> {
    try {
      const records = await prisma.workflowEdge.findMany({
        where: { instanceId, sourceNodeId },
        orderBy: { createdAt: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow edges by source', { instanceId, sourceNodeId, error: err.message })
    }
  }

  async findByTarget(instanceId: string, targetNodeId: string): Promise<WorkflowEdge[]> {
    try {
      const records = await prisma.workflowEdge.findMany({
        where: { instanceId, targetNodeId },
        orderBy: { createdAt: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow edges by target', { instanceId, targetNodeId, error: err.message })
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.workflowEdge.delete({ where: { id } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow edge', { id, error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowEdge {
    return {
      id: record.id,
      instanceId: record.instanceId,
      edgeId: record.edgeId,
      sourceNodeId: record.sourceNodeId,
      targetNodeId: record.targetNodeId,
      condition: record.condition,
      label: record.label,
      metadata: record.metadata,
    }
  }
}

export const workflowEdgeRepository = new WorkflowEdgeRepository()
