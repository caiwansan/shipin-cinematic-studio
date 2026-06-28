// ============================================================
// WorkflowDefinition Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowDefinition } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowDefinitionRepository {
  async create(data: WorkflowDefinition): Promise<WorkflowDefinition> {
    try {
      const graph = typeof data.graph === 'object' ? JSON.stringify(data.graph) : data.graph
      const variables = data.variables ? (typeof data.variables === 'object' ? JSON.stringify(data.variables) : data.variables) : null
      const permissions = data.permissions ? (typeof data.permissions === 'object' ? JSON.stringify(data.permissions) : data.permissions) : null
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowDefinition.create({
        data: {
          code: data.code,
          name: data.name,
          version: data.version,
          description: data.description || null,
          trigger: data.trigger || 'manual',
          graph,
          variables,
          permissions,
          status: data.status || 'active',
          category: data.category || null,
          metadata,
          schemaVersion: data.schemaVersion || 1,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow definition', { error: err.message })
    }
  }

  async findById(id: string): Promise<WorkflowDefinition | null> {
    try {
      const record = await prisma.workflowDefinition.findUnique({ where: { id } })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow definition', { id, error: err.message })
    }
  }

  async findByCode(code: string): Promise<WorkflowDefinition | null> {
    try {
      const record = await prisma.workflowDefinition.findUnique({ where: { code } })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow definition by code', { code, error: err.message })
    }
  }

  async list(filter?: { status?: string; category?: string }): Promise<WorkflowDefinition[]> {
    try {
      const where: any = {}
      if (filter?.status) where.status = filter.status
      if (filter?.category) where.category = filter.category

      const records = await prisma.workflowDefinition.findMany({ where, orderBy: { updatedAt: 'desc' } })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to list workflow definitions', { error: err.message })
    }
  }

  async update(id: string, data: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    try {
      const updateData: any = { ...data }
      if (data.graph) updateData.graph = typeof data.graph === 'object' ? JSON.stringify(data.graph) : data.graph
      if (data.variables) updateData.variables = typeof data.variables === 'object' ? JSON.stringify(data.variables) : data.variables
      // Remove id from update data
      delete updateData.id
      delete updateData.createdAt
      delete updateData.updatedAt

      const record = await prisma.workflowDefinition.update({ where: { id }, data: updateData })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to update workflow definition', { id, error: err.message })
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.workflowDefinition.delete({ where: { id } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow definition', { id, error: err.message })
    }
  }

  async count(filter?: { status?: string; category?: string }): Promise<number> {
    try {
      const where: any = {}
      if (filter?.status) where.status = filter.status
      if (filter?.category) where.category = filter.category
      return prisma.workflowDefinition.count({ where })
    } catch (err: any) {
      throw new RepositoryError('Failed to count workflow definitions', { error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowDefinition {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      version: record.version,
      description: record.description,
      trigger: record.trigger,
      graph: record.graph,
      variables: record.variables,
      permissions: record.permissions,
      status: record.status,
      category: record.category,
      metadata: record.metadata,
      schemaVersion: record.schemaVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export const workflowDefinitionRepository = new WorkflowDefinitionRepository()
