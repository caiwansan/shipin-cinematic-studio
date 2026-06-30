// ============================================================
// GEO Report Routes — REST API (Sprint 4 Data Integration)
// GET /api/geo/reports?projectId=xxx&type=brand|knowledge|evidence|executive
//
// 报告不存储为表，而是实时从现有数据生成。
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoReportGenerator } from '../services/geo-report-generator.service'

export default async function geoReportRoutes(fastify: FastifyInstance) {
  // GET /api/geo/reports?projectId=xxx — 列出可用报告类型
  fastify.get('/api/geo/reports', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.query as any
      if (!projectId) {
        return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
      }

      const types = await geoReportGenerator.listAvailableTypes(projectId)
      return { success: true, data: types }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/reports/generate?projectId=xxx&type=brand — 生成指定类型报告
  fastify.get('/api/geo/reports/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId, type } = request.query as any
      if (!projectId || !type) {
        return reply.status(400).send({ success: false, error: '需要 projectId 和 type' })
      }

      const report = await geoReportGenerator.generate(projectId, type)
      if (!report) {
        return reply.status(400).send({ success: false, error: `不支持的报告类型: ${type}` })
      }

      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
