// ============================================================
// GEO Scan Routes — REST API (Sprint P1)
// ============================================================

import { FastifyInstance } from 'fastify'
import { prisma } from '../../../utils/index'

interface ScanCreateBody {
  projectId: string
  scanType?: string
  topic?: string
}

export default async function geoScanRoutes(fastify: FastifyInstance) {
  // POST /api/geo/scans — Start a scan (Entity Discovery flow)
  fastify.post('/api/geo/scans', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as ScanCreateBody
    const user = request.user as any

    if (!body.projectId) {
      return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
    }

    try {
      // Verify project exists
      const project = await prisma.gEOProject.findUnique({ where: { id: body.projectId } })
      if (!project || project.deletedAt) {
        return reply.status(404).send({ success: false, error: '项目未找到' })
      }

      // Check if there's already a running scan
      const runningScan = await prisma.geoScanHistory.findFirst({
        where: { projectId: body.projectId, status: 'running' },
      })
      if (runningScan) {
        return reply.status(409).send({ success: false, error: '当前项目已有扫描任务正在运行' })
      }

      const scanType = body.scanType || 'website'
      const topic = body.topic || project.topic || project.name

      // Create scan record
      const scan = await prisma.geoScanHistory.create({
        data: {
          projectId: body.projectId,
          scanType,
          status: 'running',
          topic,
          startedAt: new Date(),
        },
      })

      // TODO: In production, trigger async entity discovery workflow here
      // For now, mark as completed after creating the record
      // The actual AI workflow will be integrated in Phase 2

      return reply.status(201).send({
        success: true,
        data: scan,
      })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/scans — List scan history
  fastify.get('/api/geo/scans', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, status } = request.query as any

    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
    }

    try {
      const where: any = { projectId }
      if (status) where.status = status

      const scans = await prisma.geoScanHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      return { success: true, data: scans, total: scans.length }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/scans/:id — Get scan detail
  fastify.get('/api/geo/scans/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const scan = await prisma.geoScanHistory.findUnique({ where: { id } })
      if (!scan) {
        return reply.status(404).send({ success: false, error: '扫描记录未找到' })
      }

      // If there's a knowledge object, fetch it
      let knowledgeObject = null
      if (scan.knowledgeObjectId) {
        knowledgeObject = await prisma.knowledgeObject.findUnique({
          where: { id: scan.knowledgeObjectId },
        })
      }

      return {
        success: true,
        data: {
          ...scan,
          knowledgeObject,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/geo/scans/:id — Delete scan record
  fastify.delete('/api/geo/scans/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const existing = await prisma.geoScanHistory.findUnique({ where: { id } })
      if (!existing) {
        return reply.status(404).send({ success: false, error: '扫描记录未找到' })
      }

      await prisma.geoScanHistory.delete({ where: { id } })
      return { success: true, data: { deleted: true } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
