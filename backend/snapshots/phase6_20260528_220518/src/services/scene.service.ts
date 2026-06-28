import { prisma } from '../utils/index.js'

export const sceneService = {
  async findByProject(projectId: string) {
    return await prisma.sceneProfile.findMany({ where: { projectId } })
  },

  async findById(id: string) {
    return await prisma.sceneProfile.findUnique({ where: { id } })
  },

  async create(projectId: string, data: any) {
    return await prisma.sceneProfile.create({
      data: { projectId, ...data },
    })
  },

  async update(id: string, data: any) {
    return await prisma.sceneProfile.update({ where: { id }, data })
  },

  async delete(id: string) {
    return await prisma.sceneProfile.delete({ where: { id } })
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

