/**
 * Phase 4: Enterprise Lead Intelligence Routes
 * /api/enterprise/leads
 */
import { FastifyInstance } from 'fastify'
import { LeadIntelligenceService } from '../services/enterprise/lead-intelligence.service'

const leadService = new LeadIntelligenceService()

export default async function enterpriseLeadsRoutes(app: FastifyInstance) {
  
  app.addHook('preHandler', app.authenticate)
  
  // Lead 统计面板
  app.get('/stats', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const stats = await leadService.getFunnelStats(tenantId)
    return { code: 0, data: stats }
  })
  
  // Lead 列表 (分页+筛选)
  app.get('/', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { temperature, status, sortBy, limit, offset } = req.query as any
    const result = await leadService.listLeads({
      tenantId, temperature, status, sortBy,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0
    })
    return { code: 0, data: result }
  })
  
  // Top 重点线索
  app.get('/top', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { n } = req.query as any
    const items = await leadService.getTopLeads(tenantId, parseInt(n) || 5)
    return { code: 0, data: items }
  })
  
  // Lead 漏斗
  app.get('/funnel', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const stats = await leadService.getFunnelStats(tenantId)
    return {
      code: 0,
      data: {
        new: stats.byStatus.new,
        contacting: stats.byStatus.contacting,
        qualified: stats.byStatus.qualified,
        opportunity: stats.byStatus.opportunity,
        won: stats.byStatus.won,
        totalOpportunityValue: stats.totalOpportunityValue
      }
    }
  })
  
  // Lead 详情
  app.get('/:id', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { id } = req.params as any
    const lead = await leadService.getLead(tenantId, id)
    return lead ? { code: 0, data: lead } : { code: 1, message: '线索不存在' }
  })
  
  // 更新 Lead (状态/分配/备注)
  app.patch('/:id', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { id } = req.params as any
    const result = await leadService.updateLead(tenantId, id, req.body as any)
    return { code: 0, data: result } as any
  })
  
  // 记录跟进动作
  app.post('/:id/action', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { id } = req.params as any
    const { action, note } = req.body as any
    const actor = (req.user as any).email || 'CEO'
    const result = await leadService.recordAction({ tenantId, leadId: id, action, note, actor })
    return result ? { code: 0, data: result } : { code: 1, message: '记录失败' }
  })
  
  // 从互动分析生成 Lead
  app.post('/analyze', async (req) => {
    const user = req.user as any
    const tenantId = user?.tenantId || user?.id
    const { platform, platformUserId, customerName, industry, companySize } = req.body as any
    const lead = await leadService.analyzeLead({
      tenantId, platform, platformUserId, customerName, industry, companySize
    })
    return lead ? { code: 0, data: lead } : { code: 1, message: '无互动数据可分析' }
  })
}
