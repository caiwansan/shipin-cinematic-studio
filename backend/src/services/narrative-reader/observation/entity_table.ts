/**
 * entity_table.ts — Entity persistence layer for Layer 2 Identity Kernel
 *
 * Rules:
 * - deterministic, rule-based identity mapping
 * - NO embedding, NO similarity scoring
 * - simple exact + alias matching
 * - docId-scoped (per-novel entities stay in their own namespace)
 */

import { prisma } from '../../../utils/index.js'

export interface EntityRecord {
  id: string
  docId: string
  canonicalName: string
  aliases: string[]
  firstChunk: string
  lastChunk: string | null
  appearanceCount: number
}

/**
 * 规范化实体名（纯规则，无 NLP）
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '')
}

/**
 * 查找或创建 entity
 * docId 隔离：不同小说的同名角色算不同 entity
 */
export async function upsertEntity(
  canonicalName: string,
  docId: string,
  chunkId: string,
): Promise<EntityRecord> {
  const normalized = normalizeName(canonicalName)

  // 精确匹配
  const existing = await prisma.entity.findFirst({
    where: {
      docId,
      canonicalName: normalized,
    },
  })

  if (existing) {
    // 更新 alias：如果未收录，加进去
    let aliases: string[] = existing.aliases as string[]
    if (!aliases.includes(canonicalName.trim())) {
      aliases = [...aliases, canonicalName.trim()]
    }

    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: {
        lastChunk: chunkId,
        appearanceCount: { increment: 1 },
        aliases,
      },
    })

    return {
      id: updated.id,
      docId: updated.docId,
      canonicalName: updated.canonicalName,
      aliases: updated.aliases as string[],
      firstChunk: updated.firstChunk,
      lastChunk: updated.lastChunk,
      appearanceCount: updated.appearanceCount,
    }
  }

  // 新建 entity
  const created = await prisma.entity.create({
    data: {
      docId,
      canonicalName: normalized,
      aliases: [canonicalName.trim()],
      firstChunk: chunkId,
      lastChunk: chunkId,
      appearanceCount: 1,
    },
  })

  return {
    id: created.id,
    docId: created.docId,
    canonicalName: created.canonicalName,
    aliases: created.aliases as string[],
    firstChunk: created.firstChunk,
    lastChunk: created.lastChunk,
    appearanceCount: created.appearanceCount,
  }
}

/**
 * 获取 doc 的全部 entity
 */
export async function getEntitiesByDoc(docId: string): Promise<EntityRecord[]> {
  const records = await prisma.entity.findMany({
    where: { docId },
    orderBy: { appearanceCount: 'desc' },
  })

  return records.map((r: any) => ({
    id: r.id,
    docId: r.docId,
    canonicalName: r.canonicalName,
    aliases: r.aliases as string[],
    firstChunk: r.firstChunk,
    lastChunk: r.lastChunk,
    appearanceCount: r.appearanceCount,
  }))
}
