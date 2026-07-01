// ============================================================
// GEO Scan Routes — REST API (Sprint P1)
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { knowledgeObjectRepository } from '../../repositories/knowledge-object.repository.js'

interface ScanCreateBody {
  projectId: string
  scanType?: string
  topic?: string
}

export default async function geoScanRoutes(fastify: FastifyInstance) {
  // POST /api/geo/scans — Start a scan (Entity Discovery flow)
  fastify.post('/api/geo/scans', { preHandler: [] }, async (request, reply) => {
    const body = request.body as ScanCreateBody
    const user = request.user as any

    if (!body.projectId) {
      return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
    }

    try {
      // Verify project exists
      const project = await geoProjectRepository.findUnique({ where: { id: body.projectId } })
      if (!project || project.deletedAt) {
        return reply.status(404).send({ success: false, error: '项目未找到' })
      }

      // Check if there's already a running scan
      const runningScan = await geoScanHistoryRepository.findFirst({
        where: { projectId: body.projectId, status: 'running' },
      })
      if (runningScan) {
        return reply.status(409).send({ success: false, error: '当前项目已有扫描任务正在运行' })
      }

      const scanType = body.scanType || 'website'
      const topic = body.topic || project.topic || project.name

      // Create scan record
      const scan = await geoScanHistoryRepository.create({
        projectId: body.projectId,
        scanType,
        status: 'running',
        config: { topic },
      })

      return reply.status(201).send({
        success: true,
        data: scan,
      })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:id/scan — Start a scan (frontend-compatible path)
  fastify.post('/api/geo/projects/:id/scan', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const user = request.user as any

    try {
      // Verify project exists
      const project = await geoProjectRepository.findUnique({ where: { id } })
      if (!project || project.deletedAt) {
        return reply.status(404).send({ success: false, error: '项目未找到' })
      }

      // Check if there's already a running scan
      const runningScan = await geoScanHistoryRepository.findFirst({
        where: { projectId: id, status: 'running' },
      })
      if (runningScan) {
        return reply.status(409).send({ success: false, error: '当前项目已有扫描任务正在运行' })
      }

      const scanType = body.scanType || 'website'
      const topic = body.topic || project.topic || project.name

      // Create scan record
      const scan = await geoScanHistoryRepository.create({
        projectId: id,
        scanType,
        status: 'running',
        topic,
      })

      return reply.status(201).send({
        success: true,
        data: { scanId: scan.id, status: scan.status, estimatedSeconds: 60 },
      })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/scans — List scan history
  fastify.get('/api/geo/scans', { preHandler: [] }, async (request, reply) => {
    const { projectId, status } = request.query as any

    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
    }

    try {
      const where: any = { projectId }
      if (status) where.status = status

      const scans = await geoScanHistoryRepository.findMany(where, { createdAt: 'desc' })

      return { success: true, data: scans, total: scans.length }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/scans/:id — Get scan detail
  fastify.get('/api/geo/scans/:id', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const scan = await geoScanHistoryRepository.findUnique({ where: { id } })
      if (!scan) {
        return reply.status(404).send({ success: false, error: '扫描记录未找到' })
      }

      // If there's a knowledge object, fetch it
      let knowledgeObject = null
      if (scan.knowledgeObjectId) {
        knowledgeObject = await knowledgeObjectRepository.findUnique({
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

  // GET /api/geo/projects/:projectId/scans/:scanId — Get scan detail (frontend-compatible)
  fastify.get('/api/geo/projects/:projectId/scans/:scanId', { preHandler: [] }, async (request, reply) => {
    const { scanId } = request.params as any

    try {
      const scan = await geoScanHistoryRepository.findUnique({ where: { id: scanId } })
      if (!scan) {
        return reply.status(404).send({ success: false, error: '扫描记录未找到' })
      }

      return {
        success: true,
        data: {
          scanId: scan.id,
          status: scan.status,
          overallScore: (scan as any).overallScore || 0,
          dimensions: {
            visibility: { score: 0, explanation: '' },
            accuracy: { score: 0, explanation: '' },
            consistency: { score: 0, explanation: '' },
            recommendation: { score: 0, explanation: '' },
          },
          scanStartedAt: scan.createdAt,
          scanFinishedAt: null,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:projectId/scans/:scanId/optimize — Get optimize suggestions
  fastify.post('/api/geo/projects/:projectId/scans/:scanId/optimize', { preHandler: [] }, async (_request, reply) => {
    return { success: true, data: [] }
  })

  // POST /api/geo/projects/:projectId/scans/:scanId/apply — Apply optimization
  fastify.post('/api/geo/projects/:projectId/scans/:scanId/apply', { preHandler: [] }, async (_request, reply) => {
    return { success: true, data: { applied: true } }
  })

  // DELETE /api/geo/scans/:id — Delete scan record
  fastify.delete('/api/geo/scans/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const existing = await geoScanHistoryRepository.findUnique({ where: { id } })
      if (!existing) {
        return reply.status(404).send({ success: false, error: '扫描记录未找到' })
      }

      await geoScanHistoryRepository.delete({ where: { id } })
      return { success: true, data: { deleted: true } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
