/**
 * services/analytics.service.ts — SaaS 事件分析系统
 *
 * 记录用户行为事件，为转化漏斗、留存分析、收入分析提供数据基础。
 *
 * 标准事件列表：
 *   script_created       - 用户创建新剧本
 *   segment_created      - 分镜生成
 *   ai_analysis          - AI 分析触发
 *   quota_hit            - 免费配额用尽
 *   upgrade_clicked      - 点击升级按钮
 *   payment_success      - 支付成功
 *   export_video         - 导出视频
 *   login                - 用户登录
 *   project_created      - 创建项目
 */

import { prisma } from '../utils/index.js'

export type AnalyticsEventType =
  | 'script_created'
  | 'segment_created'
  | 'ai_analysis'
  | 'quota_hit'
  | 'upgrade_clicked'
  | 'payment_success'
  | 'export_video'
  | 'login'
  | 'project_created'

/**
 * 记录用户行为事件
 * 异步 fire-and-forget，不阻塞主流程
 */
export async function track(
  userId: string,
  event: AnalyticsEventType,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId,
        event,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    })
  } catch (err) {
    // 埋点失败不影响主流程，仅输出 error 日志
    console.error(`[Analytics] failed to track ${event} for user ${userId}:`, err)
  }
}

/**
 * 批量查询事件
 */
export async function queryEvents(
  options: {
    event?: AnalyticsEventType
    userId?: string
    fromDate?: Date
    toDate?: Date
    limit?: number
    offset?: number
  } = {},
) {
  const where: any = {}

  if (options.event) where.event = options.event
  if (options.userId) where.userId = options.userId
  if (options.fromDate || options.toDate) {
    where.createdAt = {}
    if (options.fromDate) where.createdAt.gte = options.fromDate
    if (options.toDate) where.createdAt.lte = options.toDate
  }

  const [events, total] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 100,
      skip: options.offset || 0,
    }),
    prisma.analyticsEvent.count({ where }),
  ])

  return { events, total }
}

/**
 * 按事件类型统计事件数量
 */
export async function countByEvent(fromDate: Date, toDate: Date): Promise<{ event: string; count: number }[]> {
  const result = await prisma.$queryRawUnsafe<{ event: string; count: bigint }[]>(
    `SELECT event, COUNT(*)::bigint as count FROM analytics_events
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY event ORDER BY count DESC`,
    fromDate,
    toDate,
  )
  return result.map(r => ({ event: r.event, count: Number(r.count) }))
}

/**
 * 用户转化漏斗统计
 * 返回每一步的独立用户数
 */
export async function funnelStats(fromDate: Date, toDate: Date) {
  const steps = [
    'script_created',
    'segment_created',
    'ai_analysis',
    'quota_hit',
    'upgrade_clicked',
    'payment_success',
  ] as AnalyticsEventType[]

  const result: { step: string; users: number }[] = []

  for (const event of steps) {
    const count = await prisma.analyticsEvent.groupBy({
      by: ['userId'],
      where: {
        event,
        createdAt: { gte: fromDate, lte: toDate },
      },
    })
    result.push({ step: event, users: count.length })
  }

  return result
}

/**
 * 获取日活跃用户数（DAU）
 */
export async function dailyActiveUsers(date: Date): Promise<number> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const result = await prisma.analyticsEvent.groupBy({
    by: ['userId'],
    where: {
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  })

  return result.length
}
