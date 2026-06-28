// ============================================================
// WorkflowVariable Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowVariable } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowVariableRepository {
  async create(data: WorkflowVariable): Promise<WorkflowVariable> {
    try {
      const value = typeof data.value === 'object' ? JSON.stringify(data.value) : data.value
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowVariable.create({
        data: {
          instanceId: data.instanceId,
          scope: data.scope,
          name: data.name,
          value,
          nodeId: data.nodeId || null,
          metadata,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow variable', { error: err.message })
    }
  }

  async upsert(data: WorkflowVariable): Promise<WorkflowVariable> {
    try {
      const value = typeof data.value === 'object' ? JSON.stringify(data.value) : data.value
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowVariable.upsert({
        where: {
          instanceId_scope_name: {
            instanceId: data.instanceId,
            scope: data.scope,
            name: data.name,
          },
        },
        create: {
          instanceId: data.instanceId,
          scope: data.scope,
          name: data.name,
          value,
          nodeId: data.nodeId || null,
          metadata,
        },
        update: {
          value,
          nodeId: data.nodeId || null,
          metadata,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to upsert workflow variable', { error: err.message })
    }
  }

  async findByInstance(instanceId: string): Promise<WorkflowVariable[]> {
    try {
      const records = await prisma.workflowVariable.findMany({
        where: { instanceId },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow variables by instance', { instanceId, error: err.message })
    }
  }

  async findByScope(instanceId: string, scope: string): Promise<WorkflowVariable[]> {
    try {
      const records = await prisma.workflowVariable.findMany({
        where: { instanceId, scope },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow variables by scope', { instanceId, scope, error: err.message })
    }
  }

  async findByName(instanceId: string, scope: string, name: string): Promise<WorkflowVariable | null> {
    try {
      const record = await prisma.workflowVariable.findUnique({
        where: {
          instanceId_scope_name: { instanceId, scope, name },
        },
      })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow variable by name', { instanceId, scope, name, error: err.message })
    }
  }

  async delete(instanceId: string, scope: string, name: string): Promise<void> {
    try {
      await prisma.workflowVariable.delete({
        where: {
          instanceId_scope_name: { instanceId, scope, name },
        },
      })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow variable', { instanceId, scope, name, error: err.message })
    }
  }

  async deleteByInstance(instanceId: string): Promise<void> {
    try {
      await prisma.workflowVariable.deleteMany({ where: { instanceId } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow variables by instance', { instanceId, error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowVariable {
    return {
      id: record.id,
      instanceId: record.instanceId,
      scope: record.scope,
      name: record.name,
      value: record.value,
      nodeId: record.nodeId,
      metadata: record.metadata,
    }
  }
}

export const workflowVariableRepository = new WorkflowVariableRepository()
