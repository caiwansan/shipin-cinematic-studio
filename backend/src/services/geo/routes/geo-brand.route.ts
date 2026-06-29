// ============================================================
// GEO Brand Routes — REST API (Sprint P1)
// ============================================================

import { FastifyInstance } from 'fastify'
import { prisma } from '../../../utils/index'

interface BrandCreateBody {
  name: string
  website?: string
  industry?: string
  region?: string
  language?: string
  description?: string
}

interface BrandUpdateBody {
  name?: string
  status?: string
}

interface BrandSettingUpdateBody {
  brandName?: string
  website?: string
  industry?: string
  region?: string
  language?: string
  description?: string
  logo?: string
  status?: string
}

async function getUserMembership(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { membership: true },
    })
    if (user?.membership?.type) return user.membership.type
  } catch { /* ignore */ }
  return 'free'
}

function getBrandQuotaLimit(membershipType: string): number {
  switch (membershipType) {
    case 'basic_vip':
    case 'basic':
      return 1
    case 'premium_vip':
    case 'premium':
    case 'advanced':
      return 10
    default:
      return 0
  }
}

export default async function geoBrandRoutes(fastify: FastifyInstance) {
  // GET /api/geo/brands — List user brands
  fastify.get('/api/geo/brands', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id

    try {
      const projects = await prisma.gEOProject.findMany({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      })

      // Get brand settings for each project
      const projectIds = projects.map(p => p.id)
      const brandSettings = await prisma.geoBrandSetting.findMany({
        where: { projectId: { in: projectIds } },
      })

      const settingsMap = new Map(brandSettings.map(s => [s.projectId, s]))

      const membershipType = await getUserMembership(userId)
      const quotaLimit = getBrandQuotaLimit(membershipType)

      const brands = projects.map(p => ({
        id: p.id,
        userId: p.userId,
        name: p.name,
        topic: p.topic,
        industry: p.industry,
        language: p.language,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        brandSetting: settingsMap.get(p.id) || null,
      }))

      return {
        success: true,
        data: brands,
        quota: {
          used: brands.length,
          limit: quotaLimit,
          membership: membershipType,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/brands — Create brand
  fastify.post('/api/geo/brands', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id
    const body = request.body as BrandCreateBody

    if (!body.name) {
      return reply.status(400).send({ success: false, error: '品牌名称不能为空' })
    }

    try {
      // Check quota
      const existingCount = await prisma.gEOProject.count({
        where: { userId, deletedAt: null },
      })
      const membershipType = await getUserMembership(userId)
      const quotaLimit = getBrandQuotaLimit(membershipType)

      if (existingCount >= quotaLimit) {
        return reply.status(403).send({
          success: false,
          error: `品牌数量已达上限（${quotaLimit}个），请升级会员`,
          quota: { used: existingCount, limit: quotaLimit, membership: membershipType },
        })
      }

      // Create project first
      const project = await prisma.gEOProject.create({
        data: {
          userId,
          name: body.name,
          industry: body.industry || '',
          language: body.language || 'zh',
          status: 'active',
          config: {},
        },
      })

      // Create brand setting
      const brandSetting = await prisma.geoBrandSetting.create({
        data: {
          projectId: project.id,
          brandName: body.name,
          website: body.website || '',
          industry: body.industry || '',
          region: body.region || '',
          language: body.language || 'zh',
          description: body.description || '',
        },
      })

      return reply.status(201).send({
        success: true,
        data: {
          id: project.id,
          userId: project.userId,
          name: project.name,
          topic: project.topic,
          industry: project.industry,
          language: project.language,
          status: project.status,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          brandSetting,
        },
      })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/brands/:id — Update brand
  fastify.put('/api/geo/brands/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as BrandUpdateBody

    try {
      const existing = await prisma.gEOProject.findUnique({ where: { id } })
      if (!existing || existing.deletedAt) {
        return reply.status(404).send({ success: false, error: '品牌未找到' })
      }

      const updated = await prisma.gEOProject.update({
        where: { id },
        data: {
          name: body.name,
          status: body.status,
        },
      })

      return {
        success: true,
        data: {
          id: updated.id,
          userId: updated.userId,
          name: updated.name,
          topic: updated.topic,
          industry: updated.industry,
          language: updated.language,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/geo/brands/:id — Soft delete brand
  fastify.delete('/api/geo/brands/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const existing = await prisma.gEOProject.findUnique({ where: { id } })
      if (!existing || existing.deletedAt) {
        return reply.status(404).send({ success: false, error: '品牌未找到' })
      }

      await prisma.gEOProject.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      return { success: true, data: { deleted: true } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/brands/:id/settings — Get brand settings
  fastify.get('/api/geo/brands/:id/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      let setting = await prisma.geoBrandSetting.findUnique({
        where: { projectId: id },
      })

      // Lazy init: if settings don't exist, auto-create defaults from project
      if (!setting) {
        const project = await prisma.gEOProject.findUnique({ where: { id } })
        if (!project || project.deletedAt) {
          return reply.status(404).send({ success: false, error: '品牌未找到' })
        }

        setting = await prisma.geoBrandSetting.create({
          data: {
            projectId: id,
            brandName: project.name,
            website: '',
            industry: project.industry || '',
            region: '',
            language: project.language || 'zh',
            description: '',
            status: 'active',
          },
        })
      }

      return { success: true, data: setting }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/brands/:id/settings — Update brand settings
  fastify.put('/api/geo/brands/:id/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as BrandSettingUpdateBody

    try {
      const existing = await prisma.geoBrandSetting.findUnique({ where: { projectId: id } })
      if (!existing) {
        return reply.status(404).send({ success: false, error: '品牌设置未找到' })
      }

      const updated = await prisma.geoBrandSetting.update({
        where: { projectId: id },
        data: {
          brandName: body.brandName,
          website: body.website,
          industry: body.industry,
          region: body.region,
          language: body.language,
          description: body.description,
          logo: body.logo,
          status: body.status,
        },
      })

      return { success: true, data: updated }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/brands/:id/status — Brand status (Provider, Scan, KO)
  fastify.get('/api/geo/brands/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const project = await prisma.gEOProject.findUnique({ where: { id } })
      if (!project || project.deletedAt) {
        return reply.status(404).send({ success: false, error: '品牌未找到' })
      }

      // Check scan history
      const recentScan = await prisma.geoScanHistory.findFirst({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
      })

      // Check KO count
      const koCount = await prisma.knowledgeObject.count({
        where: { projectId: id },
      })

      // Check keyword count
      const keywordCount = await prisma.geoKeyword.count({
        where: { projectId: id },
      })

      // Check brand setting
      const brandSetting = await prisma.geoBrandSetting.findUnique({
        where: { projectId: id },
      })

      return {
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            industry: project.industry,
            language: project.language,
          },
          brandSetting: brandSetting ? {
            configured: true,
            hasWebsite: !!brandSetting.website,
            websiteUrl: brandSetting.website,
          } : { configured: false },
          provider: {
            configured: false, // Checked separately via provider-status endpoint
            message: '请先在设置中配置 AI Provider',
          },
          scan: recentScan ? {
            hasScanned: true,
            status: recentScan.status,
            scanType: recentScan.scanType,
            lastScanAt: recentScan.createdAt.toISOString(),
          } : { hasScanned: false },
          knowledge: {
            koCount,
            keywordCount,
          },
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
