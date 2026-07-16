/**
 * Phase 4: Enterprise ROI Dashboard Routes
 * /api/enterprise/roi
 */
import { FastifyInstance } from 'fastify'
import { ROIDashboardService } from '../services/enterprise/roi-dashboard.service'

const roiService = new ROIDashboardService()

export default async function enterpriseROIRoutes(app: FastifyInstance) {
  
  app.addHook('preHandler', app.authenticate)
  
  // ROI 总览 (投入/产出/预测)
  app.get('/', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const overview = await roiService.getROIOverview(tenantId)
    return { code: 0, data: overview }
  })
  
  // ROI 趋势
  app.get('/trend', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { period, limit } = req.query as any
    const trend = await roiService.getROITrend(
      tenantId,
      period || 'daily',
      parseInt(limit) || 30
    )
    return { code: 0, data: trend }
  })
  
  // 按渠道分解
  app.get('/channels', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const breakdown = await roiService.getChannelBreakdown(tenantId)
    return { code: 0, data: breakdown }
  })
  
  // 按Agent分解
  app.get('/agents', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const breakdown = await roiService.getAgentBreakdown(tenantId)
    return { code: 0, data: breakdown }
  })
  
  // 记录成交
  app.post('/win', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { leadId, actualValue } = req.body as any
    const result = await roiService.recordWin(tenantId, leadId, parseInt(actualValue) || 0)
    return result
  })
}
