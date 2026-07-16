/**
 * Phase 4: Sales Advisor Service — CEO销售参谋（不是销售机器人）
 * CTO修正5: 只做建议，不自动联系客户
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class SalesAdvisorService {
  
  /**
   * 今日重点客户建议
   * 输出: 今天最值得跟进的N个人 + 为什么 + 下一步
   */
  async getDailyBrief(tenantId: string, n: number = 5) {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    
    // 1. 获取热线索 (priority排序)
    const hotLeads = await prisma.enterpriseLeadIntelligence.findMany({
      where: {
        tenantId,
        temperature: { in: ['hot', 'customer'] },
        status: { notIn: ['won', 'lost'] }
      },
      orderBy: { purchaseProb: 'desc' },
      take: n
    })
    
    // 2. 获取今天应跟进的线索（使用日期范围匹配）
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    
    const scheduledToday = await prisma.enterpriseLeadIntelligence.findMany({
      where: {
        tenantId,
        nextActionDate: { gte: todayStart, lte: todayEnd },
        status: { notIn: ['won', 'lost'] }
      },
      orderBy: { purchaseProb: 'desc' }
    })
    
    // 3. 合并去重
    const leadMap = new Map<string, any>()
    for (const l of [...hotLeads, ...scheduledToday]) {
      if (!leadMap.has(l.id)) leadMap.set(l.id, l)
    }
    const combined = Array.from(leadMap.values()).slice(0, n)
    
    // 4. 为每个线索生成建议
    const recommendations = await Promise.all(
      combined.map(async (lead) => {
        // 获取最新互动
        const latestIx = await prisma.enterpriseInteraction.findFirst({
          where: { tenantId, platform: lead.platform, platformUserId: lead.platformUserId },
          orderBy: { createdAt: 'desc' }
        })
        
        const signals = JSON.parse(lead.intentSignals || '[]')
        const topSignal = signals[0]?.evidence || '持续互动'
        
        return {
          leadId: lead.id,
          customerName: lead.customerName,
          platform: lead.platform,
          industry: lead.industry,
          temperature: lead.temperature,
          purchaseProb: lead.purchaseProb,
          estimatedValue: lead.estimatedValue,
          nextAction: lead.nextAction,
          latestInteraction: latestIx?.content?.slice(0, 80) || topSignal,
          priority: lead.purchaseProb >= 75 ? 'urgent' : lead.purchaseProb >= 60 ? 'high' : 'normal'
        }
      })
    )
    
    return {
      date: todayStr,
      total: recommendations.length,
      recommendations
    }
  }
  
  /**
   * 客户360视图
   */
  async getCustomer360(tenantId: string, leadId: string) {
    const lead = await prisma.enterpriseLeadIntelligence.findFirst({
      where: { id: leadId, tenantId }
    })
    if (!lead) return null
    
    // 所有互动
    const interactions = await prisma.enterpriseInteraction.findMany({
      where: { tenantId, platform: lead.platform, platformUserId: lead.platformUserId },
      orderBy: { createdAt: 'desc' }
    })
    
    // 该客户看到的内容
    const contentViews = await prisma.enterpriseContentPublish.findMany({
      where: { tenantId, platform: lead.platform },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    const signals = JSON.parse(lead.intentSignals || '[]')
    const noteHistory = lead.note || ''
    
    return {
      ...lead,
      intentSignals: signals,
      interactions: interactions.map(ix => ({
        type: ix.interactionType,
        content: ix.content,
        time: ix.createdAt
      })),
      contentViews: contentViews.map(c => ({
        title: c.title,
        platform: c.platform,
        createdAt: c.createdAt
      })),
      noteHistory
    }
  }
  
  /**
   * 获取跟进建议（AI生成）
   */
  async getRecommendations(tenantId: string) {
    const leads = await prisma.enterpriseLeadIntelligence.findMany({
      where: {
        tenantId,
        status: { notIn: ['won', 'lost'] },
        purchaseProb: { gte: 40 }
      },
      orderBy: { purchaseProb: 'desc' },
      take: 10
    })
    
    return leads.map(l => ({
      leadId: l.id,
      customer: l.customerName,
      reason: l.nextAction,
      suggestedScript: generateScript(l),
      priority: l.purchaseProb
    }))
  }
}

/**
 * 生成推荐话术（基于证据，不是随机）
 */
function generateScript(lead: any): string {
  const signals = JSON.parse(lead.intentSignals || '[]')
  const topSignal = signals[0]
  
  if (topSignal?.type === 'pricing_question') {
    return `您好${lead.customerName || ''}，根据您的需求，我们提供三档方案：Starter(¥999/月，适合小规模试用)、Growth(¥2999/月，含全渠道覆盖)。如需定制方案可以联系我。`
  }
  
  if (topSignal?.type === 'case_interest') {
    return `您好${lead.customerName || ''}，我们在${lead.industry || '本行业'}已有多家成功案例。为您整理了${lead.industry || '行业'}案例数据，效果提升30%+。需要详细聊聊吗？`
  }
  
  return `您好${lead.customerName || ''}，感谢您持续关注！我们在${lead.industry || '数字化'}领域有一套成熟方案。方便时为您安排一个15分钟演示？`
}
