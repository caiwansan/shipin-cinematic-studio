/**
 * Signal Service — 业务信号采集
 * 职责: Event → Signal
 * 禁止: 直接生成建议
 */
import { prisma } from '../../../utils/index.js'
import { tenantOnly, isDemoTenant } from '../../../enterprise/reality/demo-boundary.js'

// ─── Signal Canonical Model (CTO Frozen) ───────────────────────
export enum SignalType {
  REVENUE = 'revenue',         // Revenue Signal
  CUSTOMER = 'customer',       // Customer Signal
  SALES = 'sales',             // Sales Signal
  OPERATION = 'operation',     // Operation Signal
  KNOWLEDGE = 'knowledge',     // Knowledge Signal
  AI_EMPLOYEE = 'ai_employee', // AI Employee Signal
}

export enum SignalSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface SignalDetectionResult {
  detected: boolean
  signalType?: SignalType
  severity?: SignalSeverity
  description?: string
  sourceEvents?: string[]
}

export class SignalService {
  /**
   * 检测信号: 从事件中发现模式
   */
  async detectSignals(tenantId: string): Promise<SignalDetectionResult[]> {
    const results: SignalDetectionResult[] = []

    // Rule 1: 商机转化风险 — 高意向商机超过24小时未跟进
    const conversionRisk = await this.detectConversionRisk(tenantId)
    if (conversionRisk.detected) results.push(conversionRisk)

    // Rule 2: 渠道衰退 — 渠道互动率下降
    const channelDecay = await this.detectChannelDecay(tenantId)
    if (channelDecay.detected) results.push(channelDecay)

    // Rule 3: 知识缺口 — 上传知识后AI仍无企业专属信息
    const knowledgeGap = await this.detectKnowledgeGap(tenantId)
    if (knowledgeGap.detected) results.push(knowledgeGap)

    // Rule 4: AI员工效率瓶颈 — 任务完成率持续偏低
    const taskBottleneck = await this.detectTaskBottleneck(tenantId)
    if (taskBottleneck.detected) results.push(taskBottleneck)

    return results
  }

  /**
   * 创建信号
   */
  async createSignal(params: {
    tenantId: string
    signalType: SignalType
    severity: SignalSeverity
    description: string
    suggestedAction?: string
    sourceEventIds: string[]
  }) {
    // 检查同类信号是否已存在
    const existing = await prisma.enterpriseSignal.findFirst({
      where: {
        ...tenantOnly(params.tenantId),
        signalType: params.signalType,
        status: 'active',
      },
    })
    if (existing) {
      // 更新已有信号的 evidence
      return prisma.enterpriseSignal.update({
        where: { id: existing.id },
        data: {
          sourceEvents: params.sourceEventIds as any,
          severity: params.severity,
          description: params.description,
        },
        select: { id: true, signalType: true, severity: true },
      })
    }

    return prisma.enterpriseSignal.create({
      data: {
        tenantId: params.tenantId,
        signalType: params.signalType,
        severity: params.severity,
        sourceEvents: params.sourceEventIds as any,
        description: params.description,
        suggestedAction: params.suggestedAction,
        status: 'active',
      },
      select: { id: true, signalType: true, severity: true, detectedAt: true },
    })
  }

  /**
   * 获取活跃信号
   */
  async getActiveSignals(tenantId: string) {
    return prisma.enterpriseSignal.findMany({
      where: { ...tenantOnly(tenantId), status: 'active' },
      orderBy: [
        { severity: 'desc' },
        { detectedAt: 'desc' },
      ],
    })
  }

  /**
   * 确认信号
   */
  async acknowledgeSignal(tenantId: string, signalId: string) {
    return prisma.enterpriseSignal.update({
      where: { id: signalId, tenantId },
      data: { status: 'acknowledged' },
    })
  }

  /**
   * 解决信号
   */
  async resolveSignal(tenantId: string, signalId: string) {
    return prisma.enterpriseSignal.update({
      where: { id: signalId, tenantId },
      data: { status: 'resolved', resolvedAt: new Date() },
    })
  }

  // ─── Signal Detection Rules ─────────────────────────────────

  private async detectConversionRisk(tenantId: string): Promise<SignalDetectionResult> {
    // 检查是否有超过24小时未跟进的高意向商机
    const hotLeads = await prisma.enterpriseLeadIntelligence.findMany({
      where: {
        ...tenantOnly(tenantId),
        status: 'hot',
        updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    })

    if (hotLeads.length >= 2) {
      return {
        detected: true,
        signalType: SignalType.SALES,
        severity: hotLeads.length >= 5 ? SignalSeverity.CRITICAL : SignalSeverity.WARNING,
        description: `${hotLeads.length}个高意向商机超过24小时未跟进`,
        sourceEvents: hotLeads.map(l => l.id),
      }
    }

    return { detected: false }
  }

  private async detectChannelDecay(tenantId: string): Promise<SignalDetectionResult> {
    // 最近24小时的内容互动事件
    const recent = await prisma.enterpriseOperationEvent.count({
      where: {
        ...tenantOnly(tenantId),
        eventType: 'content_interaction',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    // 前24小时
    const previous = await prisma.enterpriseOperationEvent.count({
      where: {
        ...tenantOnly(tenantId),
        eventType: 'content_interaction',
        createdAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    })

    if (previous > 0 && recent / previous < 0.7) {
      return {
        detected: true,
        signalType: SignalType.OPERATION,
        severity: SignalSeverity.WARNING,
        description: `内容互动率较昨日下降${Math.round((1 - recent / previous) * 100)}%`,
        sourceEvents: [],
      }
    }

    return { detected: false }
  }

  private async detectKnowledgeGap(tenantId: string): Promise<SignalDetectionResult> {
    const knowledgeCount = await prisma.enterpriseKnowledge.count({
      where: { ...tenantOnly(tenantId), status: 'published' },
    })

    const agentCount = await prisma.enterpriseAgentProfile.count({
      where: { ...tenantOnly(tenantId), status: 'active' },
    })

    if (agentCount > 0 && knowledgeCount === 0) {
      return {
        detected: true,
        signalType: SignalType.KNOWLEDGE,
        severity: SignalSeverity.WARNING,
        description: 'AI员工缺少企业知识输入，建议上传产品资料',
        sourceEvents: [],
      }
    }

    return { detected: false }
  }

  private async detectTaskBottleneck(tenantId: string): Promise<SignalDetectionResult> {
    // 简单规则：今日完成任务为0
    const todayEvents = await prisma.enterpriseOperationEvent.count({
      where: {
        ...tenantOnly(tenantId),
        eventType: 'task_completed',
        createdAt: { gte: new Date().setHours(0, 0, 0, 0) },
      },
    })

    if (todayEvents === 0) {
      return {
        detected: true,
        signalType: SignalType.AI_EMPLOYEE,
        severity: SignalSeverity.INFO,
        description: '今日暂无任务完成记录，AI员工可能处于待命状态',
        sourceEvents: [],
      }
    }

    return { detected: false }
  }
}

export const signalService = new SignalService()
