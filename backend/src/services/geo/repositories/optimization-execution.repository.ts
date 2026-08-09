// ============================================================
// Optimization Execution Repository — CRUD for OptimizationExecution
// ============================================================

import { prisma } from '../../../utils/index'

export const optimizationExecutionRepository = {
  async findUnique(where: any) {
    return prisma.optimizationExecution.findUnique({ where: where.id || where })
  },

  async findMany(where: any, options?: { orderBy?: any; take?: number; skip?: number }): Promise<any[]> {
    const effectiveWhere = where.where || where
    const effectiveOptions = options || (where.where ? { orderBy: where.orderBy, take: where.take, skip: where.skip } : undefined)
    const opts: any = { where: effectiveWhere }
    if (effectiveOptions?.orderBy) opts.orderBy = effectiveOptions.orderBy
    if (effectiveOptions?.take) opts.take = effectiveOptions.take
    if (effectiveOptions?.skip) opts.skip = effectiveOptions.skip
    return prisma.optimizationExecution.findMany(opts)
  },

  async count(where: any) {
    const effectiveWhere = where.where || where
    return prisma.optimizationExecution.count({ where: effectiveWhere })
  },

  async create(data: any) {
    return prisma.optimizationExecution.create({ data })
  },

  async update(where: any, data: any) {
    return prisma.optimizationExecution.update({
      where: where.id || where,
      data,
    })
  },

  async delete(where: any) {
    return prisma.optimizationExecution.delete({
      where: where.id || where,
    })
  },
}
