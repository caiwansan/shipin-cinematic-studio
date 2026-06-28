/**
 * Event Log — 系统事实层
 *
 * 铁律：
 * 1. 所有状态变更必须通过 emitEvent() 写入 event_log
 * 2. emitEvent 与业务状态更新必须在同一事务内
 * 3. emitEvent 是唯一业务事实入口
 * 4. Prisma middleware 只做 debug trace，不做事件写入
 */
import { PrismaClient } from '@prisma/client'
import { prisma } from '../../utils/index.js'

export interface EmitEventParams {
  entityType: string
  entityId: string
  eventType: string
  payload?: any
  userId?: string
  tenantId?: string
  traceId?: string
  requestId?: string
}

/**
 * 写入事件日志
 * @param tx Prisma 事务客户端（必须传，确保与状态更新在同一事务）
 */
export async function emitEvent(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  params: EmitEventParams,
) {
  return tx.eventLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      payload: params.payload ?? {},
      traceId: params.traceId,
      requestId: params.requestId,
    },
  })
}

/**
 * 查询事件日志（调试/审计用）
 */
export async function queryEvents(params: {
  entityType?: string
  entityId?: string
  eventType?: string
  limit?: number
  offset?: number
}) {
  const where: any = {}
  if (params.entityType) where.entityType = params.entityType
  if (params.entityId) where.entityId = params.entityId
  if (params.eventType) where.eventType = params.eventType

  return prisma.eventLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: params.limit || 50,
    skip: params.offset || 0,
  })
}
