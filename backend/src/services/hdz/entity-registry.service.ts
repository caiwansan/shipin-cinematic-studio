/**
 * services/hdz/entity-registry.service.ts — Phase X Entity Registry
 *
 * 实体注册表：人物/物品/地点/事件的统一 ID 管理。
 * 所有虚构世界中的实体都必须通过此服务注册和检索。
 *
 * 铁律：
 * 1. Writer 输出中禁止裸字符串引用角色/物品名，必须使用 entity_id
 * 2. resolveName() 用于从自然语言名查找已有实体，不存在时自动注册
 * 3. 每个实体在项目内具有唯一 name
 */

import { entityRegistryRepository } from './repositories/entity-registry.repository.js'
import { hdzCharacterRepository } from './repositories/hdz-character.repository.js'

export type EntityType = 'character' | 'item' | 'location' | 'event'

export interface EntityRecord {
  id: string
  projectId: string
  entityType: EntityType
  name: string
  aliases: string[]
  createdAt: Date
}

/**
 * 通过 entity_id 获取实体记录
 */
export async function getEntityById(entityId: string): Promise<EntityRecord | null> {
  const row = await entityRegistryRepository.findUnique({ where: { id: entityId } })
  if (!row) return null
  return {
    id: row.id,
    projectId: row.projectId,
    entityType: row.entityType as EntityType,
    name: row.name,
    aliases: (row.aliases as string[]) || [],
    createdAt: row.createdAt,
  }
}

/**
 * 通过自然语言名称解析实体 ID。
 * 如果找到已有实体，返回其 ID；如果找不到，自动注册新实体。
 *
 * @param projectId 项目ID
 * @param name 实体名称（如"李默""玄铁剑"）
 * @param entityType 实体类型（character | item | location | event）
 * @param alias 可选的别名，注册时一同保存
 */
export async function resolveName(
  projectId: string,
  name: string,
  entityType: EntityType,
  alias?: string,
): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('实体名不能为空')

  // 1. 精确匹配
  const exact = await entityRegistryRepository.findUnique({
    where: { projectId_name: { projectId, name: trimmed } },
  })
  if (exact) return exact.id

  // 2. 模糊匹配：检查是否有同名实体（通过别名）
  const all = await entityRegistryRepository.findMany({
    where: { projectId, entityType },
  })
  const matched = all.find(e => {
    const aliases: string[] = (e.aliases as string[]) || []
    return aliases.includes(trimmed)
  })
  if (matched) return matched.id

  // 3. 自动注册
  const created = await entityRegistryRepository.create({
    data: {
      projectId,
      entityType,
      name: trimmed,
      aliases: alias ? [alias] : [],
    },
  })
  console.log(`[EntityRegistry] 新注册: ${trimmed} (${entityType}) → ${created.id}`)
  return created.id
}

/**
 * 批量解析实体名称（批量模式调用 resolveName，减少 DB 往返）
 */
export async function resolveNames(
  projectId: string,
  names: string[],
  entityType: EntityType,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const name of names) {
    result[name] = await resolveName(projectId, name, entityType)
  }
  return result
}

/**
 * 强制将现有 HdzCharacter 的 name 注册到 EntityRegistry。
 * 迁移工具：用于将已有角色迁移到新系统。
 */
export async function migrateCharacterToEntity(projectId: string, characterId: string): Promise<string | null> {
  const char = await hdzCharacterRepository.findUnique({ where: { id: characterId } })
  if (!char) return null

  const existing = await entityRegistryRepository.findUnique({
    where: { projectId_name: { projectId, name: char.name } },
  })
  if (existing) return existing.id

  const created = await entityRegistryRepository.create({
    data: {
      projectId,
      entityType: 'character',
      name: char.name,
      aliases: [],
    },
  })
  return created.id
}

/**
 * 批量迁移项目所有角色到 EntityRegistry（幂等）
 */
export async function migrateAllCharacters(projectId: string): Promise<number> {
  const chars = await hdzCharacterRepository.findMany({ where: { projectId } })
  let count = 0
  for (const ch of chars) {
    const id = await migrateCharacterToEntity(projectId, ch.id)
    if (id) count++
  }
  console.log(`[EntityRegistry] 迁移完成: ${count}/${chars.length} 角色已注册`)
  return count
}

/**
 * 获取项目所有实体（按类型分组）
 */
export async function getAllEntities(projectId: string): Promise<Record<EntityType, EntityRecord[]>> {
  const rows = await entityRegistryRepository.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }) as any[]
  const grouped: Record<string, EntityRecord[]> = { character: [], item: [], location: [], event: [] }
  for (const row of rows) {
    const rec: EntityRecord = {
      id: row.id,
      projectId: row.projectId,
      entityType: row.entityType as EntityType,
      name: row.name,
      aliases: (row.aliases as string[]) || [],
      createdAt: row.createdAt,
    }
    const t = rec.entityType
    if (grouped[t]) grouped[t].push(rec)
    else grouped[t] = [rec]
  }
  return grouped as Record<EntityType, EntityRecord[]>
}

/**
 * 添加别名到已有实体
 */
export async function addAlias(entityId: string, alias: string): Promise<void> {
  const entity = await entityRegistryRepository.findUnique({ where: { id: entityId } })
  if (!entity) throw new Error(`实体 ${entityId} 不存在`)
  const aliases: string[] = (entity.aliases as string[]) || []
  if (!aliases.includes(alias)) {
    aliases.push(alias)
    await entityRegistryRepository.update(
      { id: entityId },
      { aliases },
    )
  }
}
