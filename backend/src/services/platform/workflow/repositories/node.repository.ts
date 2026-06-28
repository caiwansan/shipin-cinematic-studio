// ============================================================
// WorkflowNode Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowNode } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowNodeRepository {
  async create(data: WorkflowNode): Promise<WorkflowNode> {
    try {
      const config = data.config ? (typeof data.config === 'object' ? JSON.stringify(data.config) : data.config) : null
      const input = data.input ? (typeof data.input === 'object' ? JSON.stringify(data.input) : data.input) : null
      const output = data.output ? (typeof data.output === 'object' ? JSON.stringify(data.output) : data.output) : null
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowNode.create({
        data: {
          instanceId: data.instanceId,
          nodeId: data.nodeId,
          type: data.type,
          name: data.name,
          config,
          status: data.status || 'pending',
          input,
          output,
          error: data.error || null,
          startedAt: data.startedAt || null,
          completedAt: data.completedAt || null,
          retryCount: data.retryCount || 0,
          metadata,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow node', { error: err.message })
    }
  }

  async bulkCreate(nodes: WorkflowNode[]): Promise<WorkflowNode[]> {
    try {
      const results: WorkflowNode[] = []
      for (const node of nodes) {
        results.push(await this.create(node))
      }
      return results
    } catch (err: any) {
      throw new RepositoryError('Failed to bulk create workflow nodes', { error: err.message })
    }
  }

  async findById(id: string): Promise<WorkflowNode | null> {
    try {
      const record = await prisma.workflowNode.findUnique({ where: { id } })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow node', { id, error: err.message })
    }
  }

  async findByInstance(instanceId: string): Promise<WorkflowNode[]> {
    try {
      const records = await prisma.workflowNode.findMany({
        where: { instanceId },
        orderBy: { createdAt: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow nodes by instance', { instanceId, error: err.message })
    }
  }

  async findByInstanceAndNodeId(instanceId: string, nodeId: string): Promise<WorkflowNode | null> {
    try {
      const record = await prisma.workflowNode.findFirst({
        where: { instanceId, nodeId },
      })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow node by instance and nodeId', { instanceId, nodeId, error: err.message })
    }
  }

  async findByStatus(instanceId: string, status: string): Promise<WorkflowNode[]> {
    try {
      const records = await prisma.workflowNode.findMany({
        where: { instanceId, status },
        orderBy: { createdAt: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow nodes by status', { instanceId, status, error: err.message })
    }
  }

  async update(id: string, data: Partial<WorkflowNode>): Promise<WorkflowNode> {
    try {
      const updateData: any = { ...data }
      if (data.config) updateData.config = typeof data.config === 'object' ? JSON.stringify(data.config) : data.config
      if (data.input) updateData.input = typeof data.input === 'object' ? JSON.stringify(data.input) : data.input
      if (data.output) updateData.output = typeof data.output === 'object' ? JSON.stringify(data.output) : data.output
      if (data.metadata) updateData.metadata = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata

      delete updateData.id
      delete updateData.instanceId
      delete updateData.createdAt

      const record = await prisma.workflowNode.update({ where: { id }, data: updateData })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to update workflow node', { id, error: err.message })
    }
  }

  async updateNodeStatus(id: string, status: string, error?: string): Promise<WorkflowNode> {
    try {
      const updateData: any = { status }
      if (error !== undefined) updateData.error = error

      if (status === 'running') {
        updateData.startedAt = new Date()
      } else if (['completed', 'failed'].includes(status)) {
        updateData.completedAt = new Date()
      }

      const record = await prisma.workflowNode.update({ where: { id }, data: updateData })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to update workflow node status', { id, status, error: err.message })
    }
  }

  async incrementRetry(id: string): Promise<WorkflowNode> {
    try {
      const record = await prisma.workflowNode.update({
        where: { id },
        data: { retryCount: { increment: 1 } },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to increment workflow node retry', { id, error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowNode {
    return {
      id: record.id,
      instanceId: record.instanceId,
      nodeId: record.nodeId,
      type: record.type,
      name: record.name,
      config: record.config,
      status: record.status,
      input: record.input,
      output: record.output,
      error: record.error,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      retryCount: record.retryCount,
      metadata: record.metadata,
    }
  }
}

export const workflowNodeRepository = new WorkflowNodeRepository()
