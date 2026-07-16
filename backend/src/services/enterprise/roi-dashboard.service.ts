/**
 * Phase 4: ROI Dashboard Service
 * CTO修正4: AI投入 / 已产生价值 / 预测价值 三分离
 */
import { PrismaClient } from '@prisma/client'
import { calculateROI } from '../../enterprise/revenue/roi-calculator'
import { DEMO_TENANT_ID } from '../../enterprise/reality/demo-boundary.js'

const prisma = new PrismaClient()

export class ROIDashboardService {
  
  /**
   * 获取 ROI 总览
   */
  async getROIOverview(tenantId: string): Promise<any> {
    // 1. 获取真实互动数据 (Phase 3.2 Tesla模拟数据)
    const interactions = await prisma.enterpriseInteraction.findMany({
      where: { tenantId }
    })
    
    // 2. 获取线索数据
    const leads = await prisma.enterpriseLeadIntelligence.findMany({
      where: { tenantId }
    })
    
    const hotLeads = leads.filter(l => ['hot', 'customer'].includes(l.temperature))
    const opportunities = leads.filter(l => l.purchaseProb >= 60)
    
    // 3. Token消耗（从dashboard service获取）
    // 这里简化：模拟真实消耗
    const tokenCost = await this.estimateTokenCost(tenantId, interactions.length)
    
    // 4. 套餐成本 (从Plan获取，这里用固定值模拟)
    const planCost = 99900  // ¥999/月 (分)
    const channelCost = 0   // 初始阶段暂为零
    
    // 5. 计算ROI
    const roiResult = calculateROI(
      { planCost, tokenCost, channelCost },
      {
        leads: leads.length,
        hotLeads: hotLeads.length,
        interactions: interactions.length,
        opportunities: opportunities.length,
        leadValues: leads.map(l => ({
          estimatedValue: l.estimatedValue,
          purchaseProb: l.purchaseProb
        }))
      }
    )
    
    return {
      ...roiResult,
      tenantId,
      calculationTime: new Date().toISOString()
    }
  }
  
  /**
   * ROI 趋势 (日/周/月)
   */
  async getROITrend(tenantId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily', limit: number = 30) {
    const snapshots = await prisma.enterpriseRoiSnapshot.findMany({
      where: { tenantId },
      orderBy: { snapshotDate: 'desc' },
      take: limit
    })
    
    return {
      period,
      data: snapshots.reverse().map(s => ({
        date: s.snapshotDate.toISOString().slice(0, 10),
        investment: s.totalCost,
        leads: s.leadsGenerated,
        hotLeads: s.hotLeads,
        opportunities: s.opportunities,
        predictedRevenue: s.estimatedRevenue,
        roiRatio: Number(s.roiRatio),
        costPerLead: s.costPerLead
      }))
    }
  }
  
  /**
   * 按渠道分解
   */
  async getChannelBreakdown(tenantId: string) {
    const interactions = await prisma.enterpriseInteraction.findMany({
      where: { tenantId },
      select: { platform: true, interactionType: true }
    })
    
    const leads = await prisma.enterpriseLeadIntelligence.findMany({
      where: { tenantId },
      select: { platform: true, temperature: true, estimatedValue: true, purchaseProb: true }
    })
    
    // 按渠道分组
    const byPlatform: Record<string, any> = {}
    
    for (const ix of interactions) {
      if (!byPlatform[ix.platform]) {
        byPlatform[ix.platform] = { platform: ix.platform, interactions: 0, leads: 0, hotLeads: 0, predictedRevenue: 0 }
      }
      byPlatform[ix.platform].interactions++
    }
    
    for (const lead of leads) {
      if (!byPlatform[lead.platform]) {
        byPlatform[lead.platform] = { platform: lead.platform, interactions: 0, leads: 0, hotLeads: 0, predictedRevenue: 0 }
      }
      byPlatform[lead.platform].leads++
      if (['hot', 'customer'].includes(lead.temperature)) {
        byPlatform[lead.platform].hotLeads++
      }
      byPlatform[lead.platform].predictedRevenue += Math.round(lead.estimatedValue * lead.purchaseProb / 100)
    }
    
    return { channels: Object.values(byPlatform) }
  }
  
  /**
   * 按Agent分解
   */
  async getAgentBreakdown(tenantId: string) {
    // 获取发布内容及其产生的线索
    const content = await prisma.enterpriseContentPublish.findMany({
      where: { tenantId, status: 'published' },
      select: { platform: true, title: true }
    })
    
    // 获取所有渠道账号
    const accounts = await prisma.enterpriseChannelAccount.findMany({
      where: { tenantId, status: 'active' },
      select: { platform: true, accountName: true }
    })
    
    // 简化：按平台归属到Agent
    const platformToAgent: Record<string, string> = {
      'wechat_official': 'AI内容经理',
      'douyin': 'AI内容经理',
      'xiaohongshu': 'AI市场分析师',
      'kuaishou': 'AI客户运营'
    }
    
    const byAgent: Record<string, any> = {}
    
    for (const c of content) {
      const agent = platformToAgent[c.platform] || 'AI增长总监'
      if (!byAgent[agent]) byAgent[agent] = { agent, contentPublished: 0 }
      byAgent[agent].contentPublished++
    }
    
    return { agents: Object.values(byAgent) }
  }
  
  /**
   * 记录成交 (win)
   */
  async recordWin(tenantId: string, leadId: string, actualValue: number) {
    await prisma.enterpriseLeadIntelligence.updateMany({
      where: { id: leadId, tenantId },
      data: { status: 'won' }
    })
    
    // 创建ROI快照
    const today = new Date().toISOString().slice(0, 10)
    const existing = await prisma.enterpriseRoiSnapshot.findFirst({
      where: { tenantId, snapshotDate: today }
    })
    
    if (existing) {
      await prisma.enterpriseRoiSnapshot.update({
        where: { id: existing.id },
        data: {
          opportunities: { increment: 1 },
          estimatedRevenue: { increment: actualValue }
        }
      })
    }
    
    return { code: 0, message: '成交已记录' }
  }
  
  /**
   * 估算Token消耗 (简化模型)
   */
  private async estimateTokenCost(tenantId: string, interactionCount: number): Promise<number> {
    // 每10次互动约产生1次内容生成（约5000token），每1000token=¥0.002
    const contentGenCount = Math.ceil(interactionCount / 10)
    const tokensUsed = contentGenCount * 5000
    const costInFen = Math.round(tokensUsed * 0.002)
    return costInFen
  }
}
