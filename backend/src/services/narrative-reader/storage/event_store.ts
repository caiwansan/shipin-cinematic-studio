/**
 * event_store.ts — Narrative Reader EventLog 存储层
 *
 * 这是 Y.1 唯一写入路径。
 */

export interface EventLogPayload {
  doc_id: string       // 文档/项目 ID
  chunk_id: string     // chunk 的唯一标识（如 "proj-xxx-ch001-p1"）
  entities: any[]
  events: any[]
  relations: any[]
  summary_state: Record<string, any>
  resolved_entities?: any[]
  metrics?: Record<string, any>
}

async function getPrisma(): Promise<any> {
  const { prisma } = await import('../../../utils/index.js')
  return prisma
}

/**
 * 写入一条 narrative observation 记录
 * 这是 Y.1 pipeline 中唯一的数据写入点
 */
export async function writeEventLog(payload: EventLogPayload): Promise<void> {
  const prisma = await getPrisma()
  await prisma.narrativeEventLog.create({
    data: {
      docId: payload.doc_id,
      chunkId: payload.chunk_id,
      entities: payload.entities,
      events: payload.events,
      relations: payload.relations,
      summaryState: payload.summary_state,
      resolvedEntities: payload.resolved_entities ?? [],
      metrics: payload.metrics ?? null,
    },
  })
}

/**
 * 批量写入（用于已完成小说的批量回放）
 */
export async function writeEventLogBatch(payloads: EventLogPayload[]): Promise<void> {
  const prisma = await getPrisma()
  await prisma.narrativeEventLog.createMany({
    data: payloads.map(p => ({
      docId: p.doc_id,
      chunkId: p.chunk_id,
      entities: p.entities,
      events: p.events,
      relations: p.relations,
      summaryState: p.summary_state,
      metrics: p.metrics ?? null,
    })),
  })
}

/**
 * 读取某个文档的所有 observation（按 chunk 顺序）
 */
export async function getEventLogByDoc(docId: string) {
  const prisma = await getPrisma()
  return prisma.narrativeEventLog.findMany({
    where: { docId },
    orderBy: { createdAt: 'asc' },
  })
}
