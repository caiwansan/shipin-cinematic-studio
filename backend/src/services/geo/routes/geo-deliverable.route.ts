// ============================================================
// GEO Deliverable Routes — Report API (P1-C)
//
// GET  /api/geo/report/:projectId                    — 获取完整报告
// GET  /api/geo/report/:projectId/export?format=...  — 导出报告 (markdown|json)
// POST /api/geo/report/:projectId/export             — 触发导出
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoReportV2Generator } from '../services/geo-report-v2.service'

export default async function geoDeliverableRoutes(fastify: FastifyInstance) {
  // GET /api/geo/report/:projectId — 获取完整报告
  fastify.get('/api/geo/report/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as any

      const report = await geoReportV2Generator.generate(projectId)
      if (!report) {
        return reply.status(404).send({
          success: false,
          error: 'No report data available. Complete at least the Discovery step first.',
        })
      }

      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/report/:projectId/export — 导出报告
  fastify.get('/api/geo/report/:projectId/export', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const { format } = request.query as any

      const report = await geoReportV2Generator.generate(projectId)
      if (!report) {
        return reply.status(404).send({
          success: false,
          error: 'No report data available.',
        })
      }

      const fmt = (format || 'json').toLowerCase()

      if (fmt === 'markdown' || fmt === 'md') {
        const md = geoReportV2Generator.toMarkdown(report)
        reply.header('Content-Type', 'text/markdown; charset=utf-8')
        reply.header('Content-Disposition', `attachment; filename="report-${projectId}.md"`)
        return reply.send(md)
      }

      // Default: json
      reply.header('Content-Type', 'application/json; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="report-${projectId}.json"`)
      return reply.send({ success: true, data: report })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/report/:projectId/export — 触发导出，返回内容
  fastify.post('/api/geo/report/:projectId/export', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const body = request.body as any
      const format = (body?.format || 'json').toLowerCase()

      const report = await geoReportV2Generator.generate(projectId)
      if (!report) {
        return reply.status(404).send({
          success: false,
          error: 'No report data available.',
        })
      }

      if (format === 'markdown' || format === 'md') {
        const md = geoReportV2Generator.toMarkdown(report)
        return { success: true, data: { format: 'markdown', content: md } }
      }

      return { success: true, data: { format: 'json', content: report } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
