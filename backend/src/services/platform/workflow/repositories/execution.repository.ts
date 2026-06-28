// ============================================================
// WorkflowExecution Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowExecution } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowExecutionRepository {
  async create(data: WorkflowExecution): Promise<WorkflowExecution> {
    try {
      const input = data.input ? (typeof data.input === 'object' ? JSON.stringify(data.input) : data.input) : null
      const output = data.output ? (typeof data.output === 'object' ? JSON.stringify(data.output) : data.output) : null
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowExecution.create({
        data: {
          instanceId: data.instanceId,
          nodeId: data.nodeId,
          executionType: data.executionType,
          executionId: data.executionId,
          status: data.status || 'pending',
          input,
          output,
          cost: data.cost || null,
          latencyMs: data.latencyMs || null,
          error: data.error || null,
          startedAt: data.startedAt || null,
          completedAt: data.completedAt || null,
          metadata,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow execution', { error: err.message })
    }
  }

  async findById(id: string): Promise<WorkflowExecution | null> {
    try {
      const record = await prisma.workflowExecution.findUnique({ where: { id } })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow execution', { id, error: err.message })
    }
  }

  async findByInstance(instanceId: string): Promise<WorkflowExecution[]> {
    try {
      const records = await prisma.workflowExecution.findMany({
        where: { instanceId },
        orderBy: { createdAt: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow executions by instance', { instanceId, error: err.message })
    }
  }

  async findByNode(instanceId: string, nodeId: string): Promise<WorkflowExecution[]> {
    try {
      const records = await prisma.workflowExecution.findMany({
        where: { instanceId, nodeId },
        orderBy: { createdAt: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow executions by node', { instanceId, nodeId, error: err.message })
    }
  }

  async update(id: string, data: Partial<WorkflowExecution>): Promise<WorkflowExecution> {
    try {
      const updateData: any = { ...data }
      if (data.output) updateData.output = typeof data.output === 'object' ? JSON.stringify(data.output) : data.output
      if (data.metadata) updateData.metadata = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata
      delete updateData.id
      delete updateData.instanceId
      delete updateData.createdAt

      const record = await prisma.workflowExecution.update({ where: { id }, data: updateData })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to update workflow execution', { id, error: err.message })
    }
  }

  async updateStatus(id: string, status: string, error?: string): Promise<WorkflowExecution> {
    try {
      const updateData: any = { status }
      if (error !== undefined) updateData.error = error

      if (status === 'running') {
        updateData.startedAt = new Date()
      } else if (['completed', 'failed'].includes(status)) {
        updateData.completedAt = new Date()
      }

      const record = await prisma.workflowExecution.update({ where: { id }, data: updateData })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to update workflow execution status', { id, status, error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowExecution {
    return {
      id: record.id,
      instanceId: record.instanceId,
      nodeId: record.nodeId,
      executionType: record.executionType,
      executionId: record.executionId,
      status: record.status,
      input: record.input,
      output: record.output,
      cost: record.cost,
      latencyMs: record.latencyMs,
      error: record.error,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      metadata: record.metadata,
    }
  }
}

export const workflowExecutionRepository = new WorkflowExecutionRepository()
