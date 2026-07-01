// ============================================================
// Event Log Repository — CRUD for EventLog
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface EventLogDTO {
  id: string
  entityType: string
  entityId: string
  eventType: string
  payload: any
  createdAt: string
}

function toDTO(record: any): EventLogDTO {
  return {
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    eventType: record.eventType,
    payload: record.payload || {},
    createdAt: record.createdAt.toISOString(),
  }
}

export const eventLogRepository = {
  async findMany(where?: any): Promise<EventLogDTO[]> {
    const records = await prisma.eventLog.findMany({ where })
    return records.map(toDTO)
  },

  async create(data: any): Promise<EventLogDTO> {
    const record = await prisma.eventLog.create({ data })
    return toDTO(record)
  },
}
