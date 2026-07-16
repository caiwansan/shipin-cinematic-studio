/**
 * Decision Service — 决策建议生成
 * 职责: Signal → Recommendation
 * 禁止: 执行动作
 */
import { prisma } from '../../../utils/index.js'
import { tenantOnly, isDemoTenant } from '../../../enterprise/reality/demo-boundary.js'

// ─── Decision Object Contract (CTO Frozen) ────────────────────
export enum RecommendationCategory {
  GROWTH = 'growth',       // Growth
  RISK = 'risk',           // Risk
  EFFICIENCY = 'efficiency', // Efficiency
  OPPORTUNITY = 'opportunity', // Opportunity
}

export enum DecisionStatus {
  DETECTED = 'detected',     // 系统检测
  REVIEWED = 'reviewed',     // CEO 查看
  ACCEPTED = 'accepted',     // CEO 认可（触发 Action）
  DISMISSED = 'dismissed',   // CEO 忽略
  EXPIRED = 'expired',       // 信号已过期（CTO 新增）
}

export interface DecisionObject {
  problem: string
  evidence: string
  impact: string
  recommendedAction: string
  confidence: number  // 0-100
}

export interface AcceptDecisionBody {
  note?: string  // CEO Decision Audit Trail (CTO 新增)
}

export class DecisionService {
  /**
   * 从信号生成建议
   */
  async generateFromSignal(tenantId: string, signalId: string) {
    const signal = await prisma.enterpriseSignal.findFirst({
      where: { id: signalId, tenantId, status: 'active' },
    })
    if (!signal) return null

    // 根据信号类型映射建议
    const decisionObj = this.mapSignalToDecision(signal)
    if (!decisionObj) return null

    return prisma.enterpriseRecommendation.create({
      data: {
        tenantId,
        signalId: signal.id,
        category: this.inferCategory(signal.signalType),
        priority: this.severityToPriority(signal.severity),
        title: decisionObj.recommendedAction,
        rationale: `${decisionObj.problem}。${decisionObj.evidence}`,
        expectedImpact: decisionObj.impact,
        actionPlan: [decisionObj.recommendedAction] as any,
        status: 'pending',
      },
      select: { id: true, title: true, category: true, priority: true },
    })
  }

  /**
   * 获取待处理建议
   */
  async getPendingRecommendations(tenantId: string) {
    return prisma.enterpriseRecommendation.findMany({
      where: { ...tenantOnly(tenantId), status: 'pending' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 10,
    })
  }

  /**
   * 获取全部建议
   */
  async getRecommendations(tenantId: string, options?: {
    status?: string
    category?: string
    limit?: number
  }) {
    const where: any = tenantOnly(tenantId)
    if (options?.status) where.status = options.status
    if (options?.category) where.category = options.category

    return prisma.enterpriseRecommendation.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: options?.limit || 20,
    })
  }

  /**
   * 批准建议
   */
  async approveRecommendation(tenantId: string, recId: string) {
    return prisma.enterpriseRecommendation.update({
      where: { id: recId, tenantId },
      data: { status: 'approved', approvedAt: new Date() },
    })
  }

  /**
   * 拒绝建议
   */
  async rejectRecommendation(tenantId: string, recId: string) {
    return prisma.enterpriseRecommendation.update({
      where: { id: recId, tenantId },
      data: { status: 'rejected' },
    })
  }

  /**
   * 标记建议过期（信号生命周期结束）
   */
  async expireDecision(tenantId: string, recId: string) {
    return prisma.enterpriseRecommendation.update({
      where: { id: recId, tenantId },
      data: { decisionStatus: DecisionStatus.EXPIRED },
    })
  }

  /**
   * 标记建议已查看（CEO 进入 Top 3 时）
   */
  async markReviewed(tenantId: string, recId: string) {
    return prisma.enterpriseRecommendation.update({
      where: { id: recId, tenantId },
      data: { decisionStatus: DecisionStatus.REVIEWED },
    })
  }

  // ─── Private ─────────────────────────────────────────────────

  private mapSignalToDecision(signal: any): DecisionObject | null {
    const mapping: Record<string, DecisionObject> = {
      sales: {
        problem: '高意向商机长时间未跟进',
        evidence: signal.description || '',
        impact: '商机冷却，转化率下降',
        recommendedAction: '分配销售助理立即跟进高意向商机',
        confidence: 75,
      },
      operation: {
        problem: '渠道内容互动率下降',
        evidence: signal.description || '',
        impact: '品牌曝光下降，获客成本上升',
        recommendedAction: '调整内容策略，增加互动型内容',
        confidence: 60,
      },
      knowledge: {
        problem: 'AI员工缺少企业知识输入',
        evidence: signal.description || '',
        impact: 'AI回复缺乏企业专属信息',
        recommendedAction: '上传产品手册、FAQ等知识资料',
        confidence: 90,
      },
      ai_employee: {
        problem: 'AI员工今日产出偏低',
        evidence: signal.description || '',
        impact: '运营节奏放缓',
        recommendedAction: '检查任务分配，调整工作优先级',
        confidence: 50,
      },
    }
    return mapping[signal.signalType] || null
  }

  private inferCategory(signalType: string): string {
    const map: Record<string, string> = {
      sales: 'growth',
      revenue: 'growth',
      customer: 'risk',
      operation: 'efficiency',
      knowledge: 'efficiency',
      ai_employee: 'efficiency',
    }
    return map[signalType] || 'opportunity'
  }

  private severityToPriority(severity: string): number {
    const map: Record<string, number> = {
      critical: 1,
      warning: 2,
      info: 3,
    }
    return map[severity] || 3
  }
}

export const decisionService = new DecisionService()
