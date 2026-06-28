/**
 * entity_resolver_v0.ts — Layer 2 Identity Kernel
 *
 * Cross-Chapter Entity Resolution (rule-based, NO embedding)
 *
 * Rules (优先级从高到低):
 * 1. exact match (normalized)
 * 2. alias match (如果同一 doc 中有别名记录)
 * 3. local co-occurrence (同一 chunk 中共现的其他 entity)
 * 4. LLM fallback (仅当有歧义 — v0 暂不实现)
 *
 * 写入: 更新 Entity 表 + enrich EventLog
 */

import { upsertEntity, normalizeName } from '../observation/entity_table.js'

export interface ResolvedRef {
  raw: string
  entityId: string
  canonicalName: string
}

/**
 * 对一段 events 中的所有 actor 做 identity resolution
 * 返回 resolved entity list，供写入 EventLog.resolvedEntities
 */
export async function resolveEntities(
  events: any[],
  docId: string,
  chunkId: string,
): Promise<ResolvedRef[]> {
  if (!events || events.length === 0) return []

  const resolvedMap = new Map<string, ResolvedRef>()  // raw → resolved

  for (const ev of events) {
    const actors: string[] = ev.actors || []
    for (const rawActor of actors) {
      if (!rawActor || typeof rawActor !== 'string') continue
      if (resolvedMap.has(rawActor)) continue

      const entity = await upsertEntity(rawActor, docId, chunkId)
      resolvedMap.set(rawActor, {
        raw: rawActor,
        entityId: entity.id,
        canonicalName: entity.canonicalName,
      })
    }
  }

  return Array.from(resolvedMap.values())
}

/**
 * 一次 resolve 所有事件中的 actor（batch variant）
 * 与上面实现一致，只为接口对齐
 */
export async function resolveEntityBatch(
  events: any[],
  docId: string,
  chunkId: string,
): Promise<ResolvedRef[]> {
  return resolveEntities(events, docId, chunkId)
}
