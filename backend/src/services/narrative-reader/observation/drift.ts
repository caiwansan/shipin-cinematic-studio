/**
 * drift.ts — Y.1 Drift Observation Layer
 *
 * 将结构化叙事观测数据转化为可测量的数值指标。
 * 三个核心指标：
 * - entity_count: 当前 chunk 中的实体数量
 * - event_count: 当前 chunk 中的事件数量
 * - relation_density: 关系数 / 事件数（叙事连接密度）
 * - entropy_proxy: 事件数 / 实体数（叙事活动度代理）
 */

export interface DriftMetrics {
  entity_count: number
  event_count: number
  relation_density: number
  entropy_proxy: number
}

/**
 * 从 Y.1 JSON output 计算 drift metrics
 */
export function computeDriftMetrics(doc: any): DriftMetrics {
  const entityCount = doc.entities?.length ?? 0
  const eventCount = doc.events?.length ?? 0
  const relationCount = doc.relations?.length ?? 0

  return {
    entity_count: entityCount,
    event_count: eventCount,
    relation_density: eventCount === 0 ? 0 : relationCount / eventCount,
    entropy_proxy: entityCount === 0 ? 1 : eventCount / entityCount,
  }
}

async function getPrisma(): Promise<any> {
  const { prisma } = await import('../../../utils/index.js')
  return prisma
}

/**
 * 写入 DriftSnapshot（用于快速查询趋势）
 */
export async function persistDriftSnapshot(payload: {
  doc_id: string
  chunk_id: string
  metrics: DriftMetrics
}): Promise<void> {
  const prisma = await getPrisma()
  await prisma.driftSnapshot.create({
    data: {
      docId: payload.doc_id,
      chunkId: payload.chunk_id,
      entityCount: payload.metrics.entity_count,
      eventCount: payload.metrics.event_count,
      relationDensity: payload.metrics.relation_density,
      entropyProxy: payload.metrics.entropy_proxy,
    },
  })
}

/**
 * 查询某个文档的 drift 时间线
 */
export async function getDriftTimeline(docId: string) {
  const prisma = await getPrisma()
  return prisma.driftSnapshot.findMany({
    where: { docId },
    orderBy: { createdAt: 'asc' },
    select: {
      chunkId: true,
      entityCount: true,
      eventCount: true,
      relationDensity: true,
      entropyProxy: true,
      createdAt: true,
    },
  })
}
