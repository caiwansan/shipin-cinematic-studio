import { prisma } from '../utils/index.js'

export const storyboardService = {
  async findByProject(projectId: string) {
    return await prisma.storyboard.findMany({ where: { projectId }, orderBy: { shotIndex: 'asc' } })
  },

  async findById(id: string) {
    return await prisma.storyboard.findUnique({ where: { id } })
  },

  async create(projectId: string, data: any) {
    const { shotIndex, ...rest } = data
    return await prisma.storyboard.create({
      data: { projectId, shotIndex: shotIndex ?? 0, ...rest },
    })
  },

  async update(id: string, data: any) {
    return await prisma.storyboard.update({ where: { id }, data })
  },

  async delete(id: string) {
    return await prisma.storyboard.delete({ where: { id } })
  },
}
