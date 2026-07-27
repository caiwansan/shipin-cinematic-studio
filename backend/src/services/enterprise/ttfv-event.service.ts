// services/enterprise/ttfv-event.service.ts — TTFV 事件追踪服务
// 复用 AgentAuditTrail 表，不新增数据模型

import { prisma } from '../../utils/index.js'

export interface TtfvEvent {
  organizationId: string
  eventType: string
  payload: Record<string, any>
}

export class TtfvEventService {
  /**
   * 记录 TTFV 生命周期事件
   * 写入 AgentAuditTrail 表，action = eventType
   */
  async trackEvent(event: TtfvEvent): Promise<void> {
    try {
      await prisma.agentAuditTrail.create({
        data: {
          tenantId: event.organizationId,
          action: event.eventType,
          resource: 'enterprise_lifecycle',
          metadata: JSON.stringify(event.payload),
        },
      })
    } catch (err: any) {
      // FK 违规时静默跳过，不影响业务
      if (err.code === 'P2003') {
        console.warn(`[TTFV] FK violation on audit trail, skipping: ${err.message}`)
      } else {
        throw err
      }
    }
  }

  /**
   * 记录企业注册事件
   */
  async trackSignup(organizationId: string, userId: string): Promise<void> {
    await this.trackEvent({
      organizationId,
      eventType: 'enterprise.lifecycle.signup',
      payload: { organizationId, userId, source: 'beta' },
    })
  }

  /**
   * 记录套餐浏览事件
   */
  async trackPricingViewed(
    organizationId: string,
    userId: string,
    planViewed: string,
    billingCycle: string
  ): Promise<void> {
    await this.trackEvent({
      organizationId,
      eventType: 'enterprise.lifecycle.pricing_viewed',
      payload: { organizationId, userId, planViewed, billingCycle },
    })
  }

  /**
   * 记录支付创建事件
   */
  async trackPaymentCreated(
    organizationId: string,
    planId: string,
    planName: string,
    cycle: string,
    amount: number,
    orderId: string
  ): Promise<void> {
    await this.trackEvent({
      organizationId,
      eventType: 'enterprise.lifecycle.payment_created',
      payload: { organizationId, planId, planName, cycle, amount, orderId },
    })
  }

  /**
   * 记录支付成功事件（TTFV 起点）
   */
  async trackPaymentSuccess(
    organizationId: string,
    subscriptionId: string,
    orderId: string,
    amount: number,
    planName: string,
    cycle: string
  ): Promise<void> {
    await this.trackEvent({
      organizationId,
      eventType: 'enterprise.lifecycle.payment_success',
      payload: {
        organizationId,
        subscriptionId,
        orderId,
        amount,
        planName,
        cycle,
        paidAt: new Date().toISOString(),
      },
    })
  }

  /**
   * 记录订阅激活事件
   */
  async trackSubscriptionActive(
    organizationId: string,
    planName: string,
    employeeLimit: number,
    channelLimit: number
  ): Promise<void> {
    await this.trackEvent({
      organizationId,
      eventType: 'enterprise.lifecycle.subscription_active',
      payload: { organizationId, planName, employeeLimit, channelLimit },
    })
  }

  /**
   * 记录 AI 员工创建事件
   */
  async trackEmployeeCreated(
    organizationId: string,
    employeeId: string,
    role: string,
    name: string,
    hasSoul: boolean,
    hasHermesBinding: boolean
  ): Promise<void> {
    await this.trackEvent({
      organizationId,
      eventType: 'enterprise.employee.created',
      payload: { organizationId, employeeId, role, name, hasSoul, hasHermesBinding },
    })
  }

  /**
   * 记录首次任务开始事件（每个企业/员工仅触发一次）
   */
  async trackFirstTaskStarted(
    organizationId: string,
    employeeId: string,
    taskId: string,
    taskType: string
  ): Promise<void> {
    // 检查是否已有首次任务事件
    const existing = await prisma.agentAuditTrail.findFirst({
      where: {
        tenantId: organizationId,
        action: 'enterprise.employee.first_task_started',
      },
    })

    if (existing) return // 已记录，跳过

    await this.trackEvent({
      organizationId,
      eventType: 'enterprise.employee.first_task_started',
      payload: {
        organizationId,
        employeeId,
        taskId,
        taskType,
        startedAt: new Date().toISOString(),
      },
    })
  }

  /**
   * 记录首次 Outcome 创建事件（TTFV 终点，每个企业/员工仅触发一次）
   */
  async trackFirstOutcomeCreated(
    organizationId: string,
    employeeId: string,
    outcomeId: string,
    outcomeType: string
  ): Promise<void> {
    // 检查是否已有首次 Outcome 事件
    const existing = await prisma.agentAuditTrail.findFirst({
      where: {
        tenantId: organizationId,
        action: 'enterprise.employee.first_outcome_created',
      },
    })

    if (existing) return // 已记录，跳过

    await this.trackEvent({
      organizationId,
      eventType: 'enterprise.employee.first_outcome_created',
      payload: {
        organizationId,
        employeeId,
        outcomeId,
        outcomeType,
        createdAt: new Date().toISOString(),
      },
    })
  }

  /**
   * 计算企业 TTFV（分钟）
   * 返回 null 表示尚未完成
   */
  async calculateTTFV(organizationId: string): Promise<number | null> {
    const events = await prisma.agentAuditTrail.findMany({
      where: {
        tenantId: organizationId,
        action: {
          in: [
            'enterprise.lifecycle.payment_success',
            'enterprise.employee.first_outcome_created',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const paymentSuccess = events.find(
      (e) => e.action === 'enterprise.lifecycle.payment_success'
    )
    const firstOutcome = events.find(
      (e) => e.action === 'enterprise.employee.first_outcome_created'
    )

    if (!paymentSuccess || !firstOutcome) return null

    const ttfvMs =
      firstOutcome.createdAt.getTime() - paymentSuccess.createdAt.getTime()
    return Math.round(ttfvMs / 60000) // 分钟
  }

  /**
   * 获取企业完整事件链（供 Dashboard 使用）
   */
  async getEnterpriseEventChain(organizationId: string): Promise<
    {
      action: string
      metadata: Record<string, any>
      createdAt: Date
    }[]
  > {
    const events = await prisma.agentAuditTrail.findMany({
      where: {
        tenantId: organizationId,
        action: {
          in: [
            'enterprise.lifecycle.signup',
            'enterprise.lifecycle.pricing_viewed',
            'enterprise.lifecycle.payment_created',
            'enterprise.lifecycle.payment_success',
            'enterprise.lifecycle.subscription_active',
            'enterprise.employee.created',
            'enterprise.employee.first_task_started',
            'enterprise.employee.first_outcome_created',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return events.map((e) => ({
      action: e.action,
      metadata: JSON.parse(e.metadata || '{}'),
      createdAt: e.createdAt,
    }))
  }
}

export const ttfvEventService = new TtfvEventService()
