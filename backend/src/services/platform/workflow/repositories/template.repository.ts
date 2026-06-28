// ============================================================
// WorkflowTemplate Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowTemplate } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowTemplateRepository {
  async create(data: WorkflowTemplate): Promise<WorkflowTemplate> {
    try {
      const template = typeof data.template === 'object' ? JSON.stringify(data.template) : data.template
      const defaultVariables = data.defaultVariables ? (typeof data.defaultVariables === 'object' ? JSON.stringify(data.defaultVariables) : data.defaultVariables) : null
      const metadata = data.metadata ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : null

      const record = await prisma.workflowTemplate.create({
        data: {
          workflowId: data.workflowId,
          code: data.code,
          name: data.name,
          description: data.description || null,
          category: data.category || null,
          template,
          defaultVariables,
          metadata,
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow template', { error: err.message })
    }
  }

  async findById(id: string): Promise<WorkflowTemplate | null> {
    try {
      const record = await prisma.workflowTemplate.findUnique({ where: { id } })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow template', { id, error: err.message })
    }
  }

  async findByCode(code: string): Promise<WorkflowTemplate | null> {
    try {
      const record = await prisma.workflowTemplate.findUnique({ where: { code } })
      return record ? this.mapToDomain(record) : null
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow template by code', { code, error: err.message })
    }
  }

  async findByWorkflow(workflowId: string): Promise<WorkflowTemplate[]> {
    try {
      const records = await prisma.workflowTemplate.findMany({
        where: { workflowId },
        orderBy: { createdAt: 'desc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow templates by workflow', { workflowId, error: err.message })
    }
  }

  async listByCategory(category: string): Promise<WorkflowTemplate[]> {
    try {
      const records = await prisma.workflowTemplate.findMany({
        where: { category },
        orderBy: { createdAt: 'desc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to list workflow templates by category', { category, error: err.message })
    }
  }

  async list(limit = 50, offset = 0): Promise<WorkflowTemplate[]> {
    try {
      const records = await prisma.workflowTemplate.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to list workflow templates', { error: err.message })
    }
  }

  async update(id: string, data: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> {
    try {
      const updateData: any = { ...data }
      if (data.template) updateData.template = typeof data.template === 'object' ? JSON.stringify(data.template) : data.template
      if (data.defaultVariables) updateData.defaultVariables = typeof data.defaultVariables === 'object' ? JSON.stringify(data.defaultVariables) : data.defaultVariables
      delete updateData.id
      delete updateData.workflowId
      delete updateData.createdAt

      const record = await prisma.workflowTemplate.update({ where: { id }, data: updateData })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to update workflow template', { id, error: err.message })
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.workflowTemplate.delete({ where: { id } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow template', { id, error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowTemplate {
    return {
      id: record.id,
      workflowId: record.workflowId,
      code: record.code,
      name: record.name,
      description: record.description,
      category: record.category,
      template: record.template,
      defaultVariables: record.defaultVariables,
      metadata: record.metadata,
    }
  }
}

export const workflowTemplateRepository = new WorkflowTemplateRepository()
