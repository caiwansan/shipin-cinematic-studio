/**
 * Phase 4: Lead Intelligence Service
 * 把 enterprise_interaction 数据转化为可解释的 Lead Intelligence
 * CTO修正3: Interaction → Evidence → Intelligence → Recommendation
 */
import { PrismaClient } from '@prisma/client'
import { evaluateLead, Interaction } from '../../enterprise/revenue/lead-scoring'
import { DEMO_TENANT_ID } from '../../enterprise/reality/demo-boundary.js'

const prisma = new PrismaClient()

export class LeadIntelligenceService {
  
  /**
   * 从互动记录生成/更新 Lead Intelligence
   */
  async analyzeLead(params: {
    tenantId: string
    platform: string
    platformUserId: string
    customerName?: string
    industry?: string
    companySize?: string
  }) {
    const { tenantId, platform, platformUserId, customerName, industry, companySize } = params
    
    // 1. 获取该平台用户的所有互动
    const interactions = await prisma.enterpriseInteraction.findMany({
      where: { tenantId, platform, platformUserId },
      orderBy: { createdAt: 'desc' }
    })
    
    if (interactions.length === 0) return null
    
    // 2. 提取评论中的第一条作为"证据来源"
    const leadInteractions: Interaction[] = interactions.map(ix => ({
      type: ix.interactionType,
      platform: ix.platform,
      content: ix.content,
      timestamp: ix.createdAt
    }))
    
    // 3. 运行 Lead Scoring Engine
    const result = evaluateLead(leadInteractions, industry || '其他', companySize)
    
    // 4. 找到该 lead 已有的记录（如果存在）
    const existing = await prisma.enterpriseLeadIntelligence.findFirst({
      where: { tenantId, platform, platformUserId }
    })
    
    // 5. 构建 intent_signals JSON（证据链）
    const intentSignals = result.evidence.map(e => ({
      type: e.type,
      evidence: e.evidence,
      weight: e.weight,
      time: e.timestamp.toISOString()
    }))
    
    const data = {
      tenantId,
      platform,
      platformUserId,
      customerName: customerName || `用户_${platformUserId.slice(0, 8)}`,
      industry: industry || '其他',
      companySize: companySize || null,
      intentScore: result.intentScore,
      intentSignals: JSON.stringify(intentSignals),
      temperature: result.temperature,
      purchaseProb: result.purchaseProb,
      probabilitySource: 'algorithm',
      estimatedValue: result.estimatedValue,
      valueSource: result.valueSource,
      nextAction: result.nextAction,
      status: existing?.status || 'new'
    }
    
    // 6. Upsert
    const lead = existing
      ? await prisma.enterpriseLeadIntelligence.update({
          where: { id: existing.id },
          data: {
            ...data,
            intentSignals: JSON.stringify(intentSignals)
          }
        })
      : await prisma.enterpriseLeadIntelligence.create({ data })
    
    return lead
  }
  
  /**
   * 获取 Lead 列表 (分页+筛选+排序)
   */
  async listLeads(params: {
    tenantId: string
    temperature?: string
    status?: string
    sortBy?: 'purchaseProb' | 'intentScore' | 'createdAt'
    limit?: number
    offset?: number
  }) {
    const { tenantId, temperature, status, sortBy = 'purchaseProb', limit = 20, offset = 0 } = params
    
    const where: any = { tenantId }
    if (temperature) where.temperature = temperature
    if (status) where.status = status
    
    const orderBy: any = {}
    if (sortBy === 'purchaseProb') orderBy.purchaseProb = 'desc'
    else if (sortBy === 'intentScore') orderBy.intentScore = 'desc'
    else orderBy.createdAt = 'desc'
    
    const [items, total] = await Promise.all([
      prisma.enterpriseLeadIntelligence.findMany({
        where, orderBy, take: limit, skip: offset
      }),
      prisma.enterpriseLeadIntelligence.count({ where })
    ])
    
    return { items, total, limit, offset }
  }
  
  /**
   * 获取 Lead 详情
   */
  async getLead(tenantId: string, id: string) {
    const lead = await prisma.enterpriseLeadIntelligence.findFirst({
      where: { id, tenantId }
    })
    if (!lead) return null
    
    // 获取关联的互动记录
    const interactions = await prisma.enterpriseInteraction.findMany({
      where: {
        tenantId,
        platform: lead.platform,
        platformUserId: lead.platformUserId
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    
    return {
      ...lead,
      intentSignals: JSON.parse(lead.intentSignals || '[]'),
      interactions
    }
  }
  
  /**
   * 更新 Lead 状态 / 分配
   */
  async updateLead(tenantId: string, id: string, data: {
    status?: string
    assignedAgent?: string
    note?: string
    nextAction?: string
    nextActionDate?: string
  }) {
    return prisma.enterpriseLeadIntelligence.updateMany({
      where: { id, tenantId },
      data: {
        ...data,
        ...(data.nextActionDate ? { nextActionDate: new Date(data.nextActionDate) } : {})
      }
    })
  }
  
  /**
   * 记录跟进动作
   */
  async recordAction(params: {
    tenantId: string
    leadId: string
    action: string
    note?: string
    actor: string
  }) {
    const lead = await prisma.enterpriseLeadIntelligence.findFirst({
      where: { id: params.leadId, tenantId: params.tenantId }
    })
    if (!lead) return null
    
    // 在 note 中追加跟进记录
    const timestamp = new Date().toLocaleString('zh-CN')
    const actionEntry = `[${timestamp}] ${params.actor}: ${params.action}${params.note ? ' — ' + params.note : ''}`
    const updatedNote = (lead.note || '') + '\n' + actionEntry
    
    return prisma.enterpriseLeadIntelligence.update({
      where: { id: lead.id },
      data: {
        note: updatedNote,
        status: lead.status === 'new' ? 'contacting' : lead.status
      }
    })
  }
  
  /**
   * Lead 漏斗统计
   */
  async getFunnelStats(tenantId: string) {
    const all = await prisma.enterpriseLeadIntelligence.findMany({
      where: { tenantId },
      select: { status: true, temperature: true, intentScore: true, estimatedValue: true }
    })
    
    const total = all.length
    const byStatus = all.reduce((m: any, l) => {
      m[l.status] = (m[l.status] || 0) + 1
      return m
    }, {})
    
    const byTemp = all.reduce((m: any, l) => {
      m[l.temperature] = (m[l.temperature] || 0) + 1
      return m
    }, { cold: 0, warm: 0, hot: 0, customer: 0 })
    
    // 总预测商机价值
    const totalOpportunityValue = all
      .filter(l => ['hot', 'customer'].includes(l.temperature))
      .reduce((s, l) => s + Math.round(l.estimatedValue * l.purchaseProb / 100), 0)
    
    return {
      total,
      byStatus: {
        new: byStatus.new || 0,
        contacting: byStatus.contacting || 0,
        qualified: byStatus.qualified || 0,
        opportunity: byStatus.opportunity || 0,
        won: byStatus.won || 0,
        lost: byStatus.lost || 0
      },
      byTemperature: byTemp,
      totalOpportunityValue,
      avgScore: total > 0 ? Math.round(all.reduce((s, l) => s + l.intentScore, 0) / total) : 0
    }
  }
  
  /**
   * 获取 Top N 重点线索
   */
  async getTopLeads(tenantId: string, n: number = 5) {
    return prisma.enterpriseLeadIntelligence.findMany({
      where: { tenantId },
      orderBy: { purchaseProb: 'desc' },
      take: n
    })
  }
}
