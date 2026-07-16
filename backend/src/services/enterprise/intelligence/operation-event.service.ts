/**
 * Operation Event Service — 企业运营事件采集
 * 职责: Collect / Normalize / Persist
 * 禁止: 判断业务价值
 */
import { prisma } from '../../../utils/index.js'
import { tenantOnly, isDemoTenant } from '../../../enterprise/reality/demo-boundary.js'

export interface OperationEventInput {
  tenantId: string
  eventType: string
  actorType: 'agent' | 'user' | 'system'
  actorId: string
  actorName?: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, any>
}

export class OperationEventService {
  /**
   * 记录一条运营事件
   */
  async recordEvent(input: OperationEventInput) {
    const event = await prisma.enterpriseOperationEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: input.eventType,
        actorType: input.actorType,
        actorId: input.actorId,
        actorName: input.actorName,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata || {},
      },
      select: { id: true, eventType: true, createdAt: true },
    })
    return event
  }

  /**
   * 批量记录事件
   */
  async recordEvents(inputs: OperationEventInput[]) {
    const events = await prisma.enterpriseOperationEvent.createMany({
      data: inputs.map(i => ({
        tenantId: i.tenantId,
        eventType: i.eventType,
        actorType: i.actorType,
        actorId: i.actorId,
        actorName: i.actorName,
        targetType: i.targetType,
        targetId: i.targetId,
        metadata: i.metadata || {},
      })),
    })
    return events
  }

  /**
   * 获取运营事件时间线
   */
  async getTimeline(tenantId: string, options?: {
    eventType?: string
    limit?: number
    offset?: number
    startTime?: Date
    endTime?: Date
  }) {
    const where: any = tenantOnly(tenantId)
    if (options?.eventType) where.eventType = options.eventType
    if (options?.startTime || options?.endTime) {
      where.createdAt = {}
      if (options.startTime) where.createdAt.gte = options.startTime
      if (options.endTime) where.createdAt.lte = options.endTime
    }

    const [events, total] = await Promise.all([
      prisma.enterpriseOperationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.enterpriseOperationEvent.count({ where }),
    ])

    return { events, total }
  }

  /**
   * 获取今日事件数
   */
  async getTodayCount(tenantId: string): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return prisma.enterpriseOperationEvent.count({
      where: {
        ...tenantOnly(tenantId),
        createdAt: { gte: today },
      },
    })
  }
}

export const operationEventService = new OperationEventService()
