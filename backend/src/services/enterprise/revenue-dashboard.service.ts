// services/enterprise/revenue-dashboard.service.ts

import { prisma } from '../../utils/index.js'

export class RevenueDashboardService {
  /**
   * 收入总览
   */
  async getOverview() {
    const subs = await prisma.enterpriseSubscription.findMany({
      where: { status: 'active' },
    })

    let mrr = 0
    let arr = 0
    for (const sub of subs) {
      const price = sub.snapshotPrice || 0
      if (sub.snapshotCycle === 'yearly') {
        mrr += Math.floor(price / 12)
      } else {
        mrr += price
      }
    }
    arr = mrr * 12

    const totalOrgs = await prisma.organization.count()
    const totalSubs = await prisma.enterpriseSubscription.count()
    const activeSubs = subs.length
    const newThisMonth = await prisma.enterpriseSubscription.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    })
    const churnThisMonth = await prisma.enterpriseSubscription.count({
      where: {
        status: 'cancelled',
        updatedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    })
    const prevActiveCount = activeSubs + churnThisMonth
    const churnRate = prevActiveCount > 0 ? churnThisMonth / prevActiveCount : 0
    const conversionRate = totalOrgs > 0 ? activeSubs / totalOrgs : 0

    return {
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      activeSubscriptions: activeSubs,
      totalSubscriptions: totalSubs,
      newSubscriptionsThisMonth: newThisMonth,
      churnThisMonth,
      churnRate: Math.round(churnRate * 10000) / 100,
      conversionRate: Math.round(conversionRate * 10000) / 100,
      totalOrganizations: totalOrgs,
    }
  }

  /**
   * 套餐分析
   */
  async getPlanAnalysis() {
    const subs = await prisma.enterpriseSubscription.findMany({
      where: { status: 'active' },
      include: { plan: true },
    })

    const planMap = new Map<string, { name: string; count: number; revenue: number; employees: number }>()

    for (const sub of subs) {
      const key = sub.snapshotName || sub.plan?.displayName || '未知'
      const existing = planMap.get(key) || { name: key, count: 0, revenue: 0, employees: 0 }
      existing.count++
      existing.revenue += sub.snapshotPrice || 0
      existing.employees += sub.snapshotMaxEmployees || 0
      planMap.set(key, existing)
    }

    const plans = Array.from(planMap.values()).map((p) => ({
      name: p.name,
      subscriberCount: p.count,
      mrrContribution: Math.round(p.revenue),
      avgEmployees: p.count > 0 ? Math.round(p.employees / p.count) : 0,
    }))

    return plans
  }

  /**
   * TTFV 分析
   */
  async getTTFVAnalysis() {
    const events = await prisma.agentAuditTrail.findMany({
      where: {
        action: {
          in: [
            'enterprise.lifecycle.payment_success',
            'enterprise.employee.first_outcome_created',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const orgPaymentMap = new Map<string, Date>()
    const orgOutcomeMap = new Map<string, Date>()

    for (const e of events) {
      if (e.action === 'enterprise.lifecycle.payment_success') {
        if (!orgPaymentMap.has(e.tenantId)) orgPaymentMap.set(e.tenantId, e.createdAt)
      }
      if (e.action === 'enterprise.employee.first_outcome_created') {
        if (!orgOutcomeMap.has(e.tenantId)) orgOutcomeMap.set(e.tenantId, e.createdAt)
      }
    }

    const ttfvList: { orgId: string; ttfvMinutes: number }[] = []
    for (const [orgId, paymentAt] of orgPaymentMap) {
      const outcomeAt = orgOutcomeMap.get(orgId)
      if (outcomeAt) {
        const ttfv = Math.round((outcomeAt.getTime() - paymentAt.getTime()) / 60000)
        ttfvList.push({ orgId, ttfvMinutes: ttfv })
      }
    }

    if (ttfvList.length === 0) {
      return {
        averageTTFV: 0,
        medianTTFV: 0,
        fastest: null,
        slowest: null,
        byEmployeeType: [],
      }
    }

    const ttfvValues = ttfvList.map((t) => t.ttfvMinutes).sort((a, b) => a - b)
    const avg = Math.round(ttfvValues.reduce((s, v) => s + v, 0) / ttfvValues.length)
    const median = ttfvValues[Math.floor(ttfvValues.length / 2)]
    const fastest = ttfvList.reduce((min, t) => (t.ttfvMinutes < min.ttfvMinutes ? t : min))
    const slowest = ttfvList.reduce((max, t) => (t.ttfvMinutes > max.ttfvMinutes ? t : max))

    return {
      averageTTFV: avg,
      medianTTFV: median,
      fastest: { orgId: fastest.orgId, ttfvMinutes: fastest.ttfvMinutes },
      slowest: { orgId: slowest.orgId, ttfvMinutes: slowest.ttfvMinutes },
      byEmployeeType: [],
    }
  }

  /**
   * 流失风险
   */
  async getChurnRisk() {
    const now = new Date()
    const fifteenDays = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const expiringSubs = await prisma.enterpriseSubscription.findMany({
      where: {
        status: 'active',
        expireAt: { lte: fifteenDays },
      },
      include: {
        organization: {
          include: {
            subscription: true,
          },
        },
      },
    })

    const highRisk: any[] = []
    const mediumRisk: any[] = []
    const lowRisk: any[] = []

    for (const sub of expiringSubs) {
      const daysRemaining = sub.expireAt
        ? Math.round((sub.expireAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : 0

      // 检查企业是否有近期活跃的 AI 员工
      const recentActiveInstances = await prisma.enterpriseAgentInstance.count({
        where: {
          tenantId: sub.organizationId,
          lastActiveAt: { gte: sevenDaysAgo },
        },
      })
      const isLowActivity = recentActiveInstances === 0

      const item = {
        organizationId: sub.organizationId,
        organizationName: sub.organization?.name || '-',
        planName: sub.snapshotName || '-',
        expireAt: sub.expireAt?.toISOString() || '-',
        daysRemaining,
        recentActivity: recentActiveInstances,
        riskReason: isLowActivity ? '7天内无员工活动' : '活跃度低',
      }

      if (daysRemaining <= 7 && isLowActivity) {
        highRisk.push(item)
      } else if (daysRemaining <= 15 || isLowActivity) {
        mediumRisk.push(item)
      } else {
        lowRisk.push(item)
      }
    }

    return { highRisk, mediumRisk, lowRisk }
  }
}

export const revenueDashboardService = new RevenueDashboardService()
