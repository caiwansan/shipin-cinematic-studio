/**
 * Phase 4: Enterprise Sales Advisor Routes
 * /api/enterprise/sales
 */
import { FastifyInstance } from 'fastify'
import { SalesAdvisorService } from '../services/enterprise/sales-advisor.service'

const advisorService = new SalesAdvisorService()

export default async function enterpriseSalesRoutes(app: FastifyInstance) {
  
  app.addHook('preHandler', app.authenticate)
  
  // 今日重点客户建议
  app.get('/daily', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { n } = req.query as any
    const brief = await advisorService.getDailyBrief(tenantId, parseInt(n) || 5)
    return { code: 0, data: brief }
  })
  
  // 客户360视图
  app.get('/customers/:leadId', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { leadId } = req.params as any
    const detail = await advisorService.getCustomer360(tenantId, leadId)
    return detail ? { code: 0, data: detail } : { code: 1, message: '客户不存在' }
  })
  
  // AI跟进建议
  app.get('/recommendations', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const recs = await advisorService.getRecommendations(tenantId)
    return { code: 0, data: recs }
  })
  
  // 生成推荐话术
  app.post('/script', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { leadId } = req.body as any
    const recs = await advisorService.getRecommendations(tenantId)
    const script = recs.find(r => r.leadId === leadId)
    return script ? { code: 0, data: script } : { code: 1, message: '未找到该客户' }
  })
}
