// ============================================================
// Prompt Template Repository — CRUD for PromptTemplate
// ============================================================

import { prisma } from '../../../utils/index'

export const promptTemplateRepository = {
  async findUnique(where: { name: string }): Promise<any | null> {
    return prisma.promptTemplate.findUnique({ where })
  },

  async findMany(where?: any, options?: { orderBy?: any }): Promise<any[]> {
    return prisma.promptTemplate.findMany({ where, ...options })
  },

  async create(data: {
    name: string
    description?: string | null
    category?: string | null
    content?: any
    variables?: any
  }): Promise<any> {
    return prisma.promptTemplate.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        content: data.content ?? {},
        variables: data.variables ?? {},
      },
    })
  },

  async update(where: { name: string }, data: any): Promise<any | null> {
    try {
      return prisma.promptTemplate.update({ where, data })
    } catch {
      return null
    }
  },
}
