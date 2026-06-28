// ============================================================
// Brand GEO — Project Service
// CRUD operations for GeoProject
// ============================================================

import { prisma } from '../../utils/index.js'

export const geoProjectService = {
  async list(userId: string) {
    return prisma.geoProject.findMany({
      where: { userId },
      include: { brandProfile: true, websiteSnapshot: true },
      orderBy: { updatedAt: 'desc' },
    })
  },

  async getById(id: string) {
    return prisma.geoProject.findUnique({
      where: { id },
      include: {
        brandProfile: true,
        websiteSnapshot: true,
        knowledgeGraph: {
          include: { outgoing: true, incoming: true },
        },
      },
    })
  },

  async create(data: {
    userId: string
    name: string
    website?: string
    industry?: string
    language?: string
    country?: string
  }) {
    return prisma.geoProject.create({
      data: {
        userId: data.userId,
        name: data.name,
        website: data.website || null,
        industry: data.industry || null,
        language: data.language || null,
        country: data.country || null,
        status: 'active',
        schemaVersion: 1,
      },
      include: { brandProfile: true, websiteSnapshot: true },
    })
  },

  async update(id: string, data: {
    name?: string
    website?: string
    industry?: string
    language?: string
    country?: string
    status?: string
  }) {
    return prisma.geoProject.update({
      where: { id },
      data,
      include: { brandProfile: true, websiteSnapshot: true },
    })
  },

  async delete(id: string) {
    // Cascade delete is handled by Prisma
    return prisma.geoProject.delete({ where: { id } })
  },
}
