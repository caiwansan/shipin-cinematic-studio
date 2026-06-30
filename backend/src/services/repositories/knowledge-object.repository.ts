// ============================================================
// KnowledgeObject Repository — CRUD for KnowledgeObject
// ============================================================

import { prisma } from '../../utils/index.js'

export const knowledgeObjectRepository = {
  async findUnique(where: any) {
    return prisma.knowledgeObject.findUnique({ where })
  },

  async findMany(whereOrOptions: any, orderByOrOptions?: any): Promise<any[]> {
    // Support both (where, options) and ({ where, ... }) signatures
    const where = whereOrOptions.where || whereOrOptions
    const effectiveOptions = orderByOrOptions || (whereOrOptions.where ? { orderBy: whereOrOptions.orderBy, select: whereOrOptions.select, distinct: whereOrOptions.distinct } : undefined)
    if (effectiveOptions && (effectiveOptions.select || effectiveOptions.distinct)) {
      return prisma.knowledgeObject.findMany({ where, ...effectiveOptions })
    }
    return prisma.knowledgeObject.findMany({ where, orderBy: effectiveOptions || { createdAt: 'desc' } })
  },

  async findFirst(whereOrOptions: any, options?: { orderBy?: any; select?: any }): Promise<any> {
    // Support both (where, options) and ({ where, ... }) signatures
    const where = whereOrOptions.where || whereOrOptions
    const effectiveOptions = options || (whereOrOptions.where ? { orderBy: whereOrOptions.orderBy, select: whereOrOptions.select } : undefined)
    if (effectiveOptions) {
      return prisma.knowledgeObject.findFirst({ where, ...effectiveOptions })
    }
    return prisma.knowledgeObject.findFirst({ where })
  },

  async count(where: any) {
    const effectiveWhere = where.where || where
    return prisma.knowledgeObject.count({ where: effectiveWhere })
  },

  async create(data: any) {
    return prisma.knowledgeObject.create({ data })
  },

  async update(where: any, data: any) {
    return prisma.knowledgeObject.update({ where, data })
  },
}
