import { FastifyInstance } from 'fastify'
import { MonitorService } from './monitor.service'
import { probeRegistry } from './probes/probe-registry'
import { prisma } from '../../utils/index.js'

const monitorService = new MonitorService(prisma)

export async function geoMonitorRoutes(app: FastifyInstance) {
  // POST /api/geo/monitor/check/published — 检测发布物上线
  app.post('/api/geo/monitor/check/published', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { publishId, platform } = req.body as any
      const result = await monitorService.checkPublished(publishId, platform || 'website')
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/monitor/check/indexed — 检测搜索引擎索引
  app.post('/api/geo/monitor/check/indexed', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { publishId } = req.body as any
      const result = await monitorService.checkIndexed(publishId)
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/monitor/drift — 检测评分漂移
  app.post('/api/geo/monitor/drift', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { projectId, threshold } = req.body as any
      const result = await monitorService.checkDrift(projectId, threshold ? Number(threshold) : undefined)
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/monitor/dashboard/:projectId — 健康仪表盘
  app.get('/api/geo/monitor/dashboard/:projectId', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const dashboard = await monitorService.getHealthDashboard(projectId)
      return { success: true, data: dashboard }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/monitor/probes — 列出所有 Probe
  app.get('/api/geo/monitor/probes', { preHandler: [app.authenticate] }, async () => {
    return { success: true, data: probeRegistry.list().map(p => ({ name: p.name, type: p.type })) }
  })

  // GET /api/geo/monitor/observations/:publishId — 获取观测历史
  app.get('/api/geo/monitor/observations/:publishId', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { publishId } = req.params as any
      const observations = await monitorService.getObservations(publishId)
      return { success: true, data: observations }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
