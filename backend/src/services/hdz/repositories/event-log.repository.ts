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
    createdAt: record.createdAt?.toISOString?.() || '',
  }
}

export const eventLogRepository = {
  async findMany(where?: any): Promise<EventLogDTO[]> {
    // Support both (where) and ({ where, orderBy, skip, take, select, include }) signatures
    if (typeof where === 'object' && where !== null) {
      const prismaKeys = ['where', 'orderBy', 'skip', 'take', 'select', 'include', 'cursor', 'distinct']
      const hasPrismaKey = prismaKeys.some(k => k in where)
      if (hasPrismaKey) {
        if (!('where' in where)) {
          const { orderBy, skip, take, select, include, cursor, distinct, ...filters } = where
          const args: any = { where: filters }
          if (orderBy) args.orderBy = orderBy
          if (skip !== undefined) args.skip = skip
          if (take !== undefined) args.take = take
          if (select) args.select = select
          if (include) args.include = include
          const records = await prisma.eventLog.findMany(args)
          return records.map(toDTO)
        }
        const records = await prisma.eventLog.findMany(where)
        return records.map(toDTO)
      }
    }
    const records = await prisma.eventLog.findMany({ where })
    return records.map(toDTO)
  },

  async create(data: any): Promise<EventLogDTO> {
    const record = await prisma.eventLog.create({ data })
    return toDTO(record)
  },
}
