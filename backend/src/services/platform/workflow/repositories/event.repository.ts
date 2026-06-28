// ============================================================
// WorkflowEvent Repository (KMKI-PLAT-011)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { WorkflowEvent } from '../types.js'

const prisma = new PrismaClient()

export class WorkflowEventRepository {
  async create(data: WorkflowEvent): Promise<WorkflowEvent> {
    try {
      const eventData = data.data ? (typeof data.data === 'object' ? JSON.stringify(data.data) : data.data) : null

      const record = await prisma.workflowEvent.create({
        data: {
          instanceId: data.instanceId,
          type: data.type,
          nodeId: data.nodeId || null,
          data: eventData,
          timestamp: data.timestamp || new Date(),
        },
      })
      return this.mapToDomain(record)
    } catch (err: any) {
      throw new RepositoryError('Failed to create workflow event', { error: err.message })
    }
  }

  async bulkCreate(events: WorkflowEvent[]): Promise<WorkflowEvent[]> {
    try {
      const results: WorkflowEvent[] = []
      for (const event of events) {
        results.push(await this.create(event))
      }
      return results
    } catch (err: any) {
      throw new RepositoryError('Failed to bulk create workflow events', { error: err.message })
    }
  }

  async findByInstance(instanceId: string, limit = 50, offset = 0): Promise<WorkflowEvent[]> {
    try {
      const records = await prisma.workflowEvent.findMany({
        where: { instanceId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow events by instance', { instanceId, error: err.message })
    }
  }

  async findByType(instanceId: string, type: string): Promise<WorkflowEvent[]> {
    try {
      const records = await prisma.workflowEvent.findMany({
        where: { instanceId, type },
        orderBy: { timestamp: 'desc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow events by type', { instanceId, type, error: err.message })
    }
  }

  async findByNode(instanceId: string, nodeId: string): Promise<WorkflowEvent[]> {
    try {
      const records = await prisma.workflowEvent.findMany({
        where: { instanceId, nodeId },
        orderBy: { timestamp: 'asc' },
      })
      return records.map(this.mapToDomain)
    } catch (err: any) {
      throw new RepositoryError('Failed to find workflow events by node', { instanceId, nodeId, error: err.message })
    }
  }

  async deleteByInstance(instanceId: string): Promise<void> {
    try {
      await prisma.workflowEvent.deleteMany({ where: { instanceId } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete workflow events by instance', { instanceId, error: err.message })
    }
  }

  private mapToDomain(record: any): WorkflowEvent {
    return {
      id: record.id,
      instanceId: record.instanceId,
      type: record.type,
      nodeId: record.nodeId,
      data: record.data,
      timestamp: record.timestamp,
    }
  }
}

export const workflowEventRepository = new WorkflowEventRepository()
