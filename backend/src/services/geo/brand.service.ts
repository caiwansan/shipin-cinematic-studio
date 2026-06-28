// ============================================================
// Brand GEO — Brand Profile Service
// CRUD operations for GeoBrandProfile
// ============================================================

import { prisma } from '../../utils/index.js'

export const geoBrandService = {
  async getByProjectId(projectId: string) {
    return prisma.geoBrandProfile.findUnique({
      where: { projectId },
    })
  },

  async create(projectId: string, data: {
    brandName?: string
    website?: string
    company?: string
    industry?: string
    primaryProducts?: string
    coreServices?: string
    targetAudience?: string
    targetRegions?: string
    primaryLanguage?: string
    competitors?: string
    keywords?: string
    brandDesc?: string
    socialLinks?: string
  }) {
    return prisma.geoBrandProfile.create({
      data: {
        projectId,
        ...data,
        schemaVersion: 1,
      },
    })
  },

  async update(projectId: string, data: {
    brandName?: string
    website?: string
    company?: string
    industry?: string
    primaryProducts?: string
    coreServices?: string
    targetAudience?: string
    targetRegions?: string
    primaryLanguage?: string
    competitors?: string
    keywords?: string
    brandDesc?: string
    socialLinks?: string
  }) {
    return prisma.geoBrandProfile.upsert({
      where: { projectId },
      create: {
        projectId,
        ...data,
        schemaVersion: 1,
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
    })
  },
}
