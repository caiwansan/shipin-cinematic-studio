// ============================================================
// ExecutionTrace Repository — CRUD for llmExecutionTrace
// ============================================================

import { prisma } from '../../utils/index.js'

export const executionTraceRepository = {
  async findMany(where: any, orderBy?: any) {
    return prisma.llmExecutionTrace.findMany({ where, orderBy: orderBy || { createdAt: 'desc' } })
  },

  async findUnique(where: any) {
    return prisma.llmExecutionTrace.findUnique({ where })
  },

  async count(where: any) {
    return prisma.llmExecutionTrace.count({ where })
  },
}
