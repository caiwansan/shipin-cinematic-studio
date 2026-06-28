// ============================================================
// WorkflowInstance Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowInstance } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowInstanceRepository {
  async create(data: WorkflowInstance): Promise<WorkflowInstance> {
    try {
      const input = data.input ? (typeof data.input === 'object' ? JSON.stringify(data.input) : data.input) : null
      const output = data.output ? (typeof data.output === 'object' ? JSON.stringify(data.output) : data.output) : null
      const result = data.result ? (typeof data.result === 'object' ? JSON.stringify(data.result) : data.result) : null
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowInstance.create({
        data: {
          workflowId: data.workflowId,
          workspaceId: data.workspaceId,
          status: data.status || 'pending',
          currentNode: data.currentNode || null,
          input,
          output,
          result,
          cost: data.cost || null,
          error: data.error || null,
          startedAt: data.startedAt || null,
          finishedAt: data.finishedAt || null,
          metadata,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow instance', { error: err.message })
    }
  }

  async findById(id: string): Promise<WorkflowInstance | null> {
    try {
      const record = await prisma.workflowInstance.findUnique({ where: { id } })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow instance', { id, error: err.message })
    }
  }

  async findByWorkflow(workflowId: string, limit = 20, offset = 0): Promise<WorkflowInstance[]> {
    try {
      const records = await prisma.workflowInstance.findMany({
        where: { workflowId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow instances', { workflowId, error: err.message })
    }
  }

  async findByWorkspace(workspaceId: string, limit = 20, offset = 0): Promise<WorkflowInstance[]> {
    try {
      const records = await prisma.workflowInstance.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow instances by workspace', { workspaceId, error: err.message })
    }
  }

  async findByStatus(status: string, limit = 50): Promise<WorkflowInstance[]> {
    try {
      const records = await prisma.workflowInstance.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow instances by status', { status, error: err.message })
    }
  }

  async update(id: string, data: Partial<WorkflowInstance>): Promise<WorkflowInstance> {
    try {
      const updateData: any = { ...data }
      if (data.input) updateData.input = typeof data.input === 'object' ? JSON.stringify(data.input) : data.input
      if (data.output) updateData.output = typeof data.output === 'object' ? JSON.stringify(data.output) : data.output
      if (data.result) updateData.result = typeof data.result === 'object' ? JSON.stringify(data.result) : data.result
      if (data.metadata) updateData.metadata = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata

      delete updateData.id
      delete updateData.createdAt
      delete updateData.updatedAt
      delete updateData.workflowId

      const record = await prisma.workflowInstance.update({ where: { id }, data: updateData })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to update workflow instance', { id, error: err.message })
    }
  }

  async updateStatus(id: string, status: string, error?: string): Promise<WorkflowInstance> {
    try {
      const updateData: any = { status }
      if (error !== undefined) updateData.error = error

      // Set timestamps based on status
      if (status === 'running') {
        updateData.startedAt = new Date()
      } else if (['completed', 'failed', 'cancelled'].includes(status)) {
        updateData.finishedAt = new Date()
      }

      const record = await prisma.workflowInstance.update({ where: { id }, data: updateData })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to update workflow instance status', { id, status, error: err.message })
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.workflowInstance.delete({ where: { id } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow instance', { id, error: err.message })
    }
  }

  async count(filter?: { status?: string; workflowId?: string; workspaceId?: string }): Promise<number> {
    try {
      const where: any = {}
      if (filter?.status) where.status = filter.status
      if (filter?.workflowId) where.workflowId = filter.workflowId
      if (filter?.workspaceId) where.workspaceId = filter.workspaceId
      return prisma.workflowInstance.count({ where })
    } catch (err: any) {
      throw new RepositoryError('Failed to count workflow instances', { error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowInstance {
    return {
      id: record.id,
      workflowId: record.workflowId,
      workspaceId: record.workspaceId,
      status: record.status,
      currentNode: record.currentNode,
      input: record.input,
      output: record.output,
      result: record.result,
      cost: record.cost,
      error: record.error,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export const workflowInstanceRepository = new WorkflowInstanceRepository()
