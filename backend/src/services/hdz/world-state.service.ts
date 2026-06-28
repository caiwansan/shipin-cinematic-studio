/**
 * services/hdz/world-state.service.ts — Phase X World State Store
 *
 * 世界状态存储：虚构世界的唯一事实源（Single Source of Truth）。
 * 所有实体（人物/物品/地点）的当前状态都存储于此。
 *
 * 铁律：
 * 1. WorldState 是唯一的事实源——NOT chapter_summary, NOT writer output
 * 2. applyStateDelta() 是写入的唯一入口
 * 3. mergeStrict() 执行"安全覆盖"策略：不允许回退版本
 */

import { prisma } from '../../utils/index.js'

// ─── 类型定义 ───

export interface EntityState {
  entityId: string
  projectId: string
  health?: number | string      // 生命值或状态描述
  inventory?: string[]           // 持有的物品 entity_id 列表
  location?: string              // 当前所在 location entity_id
  relationships?: Record<string, string>  // { targetEntityId: "友好/敌对/师徒" }
  statusFlags?: Record<string, any>       // { isAlive: true, armInjured: false, hasAwakened: true }
  version: number
  updatedAt: string
}

/**
 * 状态变更增量 —— Writer 必须输出
 */
export interface StateDelta {
  entityId: string
  health?: number | string | null   // null = 不改变
  inventoryAdd?: string[]            // 获得物品
  inventoryRemove?: string[]         // 失去物品
  location?: string | null
  relationshipChanges?: Array<{ targetEntityId: string; newType: string }>
  statusFlagChanges?: Record<string, any | null>  // null = 移除标志
}

interface InternalStateRow {
  id: string
  projectId: string
  entityId: string
  stateJson: any
  version: number
  updatedAt: Date
}

// ─── 核心 API ───

/**
 * 获取一批实体的当前世界状态
 * @param projectId 项目ID
 * @param entityIds 要查询的实体ID列表（空数组 = 返回全部）
 */
export async function getWorldState(projectId: string, entityIds?: string[]): Promise<Map<string, EntityState>> {
  const where: any = { projectId }
  if (entityIds && entityIds.length > 0) {
    where.entityId = { in: entityIds }
  }

  const rows = await prisma.worldState.findMany({ where }) as InternalStateRow[]
  const map = new Map<string, EntityState>()

  for (const row of rows) {
    map.set(row.entityId, {
      entityId: row.entityId,
      projectId: row.projectId,
      ...(typeof row.stateJson === 'object' ? row.stateJson : {}),
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    })
  }
  return map
}

/**
 * 获取单个实体的世界状态
 */
export async function getEntityState(projectId: string, entityId: string): Promise<EntityState | null> {
  const row = await prisma.worldState.findUnique({
    where: { projectId_entityId: { projectId, entityId } },
  }) as InternalStateRow | null
  if (!row) return null
  return {
    entityId: row.entityId,
    projectId: row.projectId,
    ...(typeof row.stateJson === 'object' ? row.stateJson : {}),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * 应用状态变更增量 —— 写入的唯一入口
 *
 * @param projectId 项目ID
 * @param deltas 状态变更列表
 * @param source 变更来源描述（如 "writer_chapter_5"）
 */
export async function applyStateDelta(
  projectId: string,
  deltas: StateDelta[],
  source: string,
): Promise<Map<string, EntityState>> {
  const result = new Map<string, EntityState>()

  for (const delta of deltas) {
    const existing = await prisma.worldState.findUnique({
      where: { projectId_entityId: { projectId, entityId: delta.entityId } },
    }) as InternalStateRow | null

    // 构建新状态
    const currentState: any = existing ? { ...(typeof existing.stateJson === 'object' ? existing.stateJson : {}) } : {}
    const newVersion = existing ? existing.version + 1 : 1

    if (delta.health !== undefined) currentState.health = delta.health
    if (delta.location !== undefined) currentState.location = delta.location

    // 处理库存变更
    if (delta.inventoryAdd && delta.inventoryAdd.length > 0) {
      const inv: string[] = currentState.inventory || []
      for (const item of delta.inventoryAdd) {
        if (!inv.includes(item)) inv.push(item)
      }
      currentState.inventory = inv
    }
    if (delta.inventoryRemove && delta.inventoryRemove.length > 0) {
      const inv: string[] = currentState.inventory || []
      currentState.inventory = inv.filter((i: string) => !delta.inventoryRemove!.includes(i))
    }

    // 处理关系变更
    if (delta.relationshipChanges && delta.relationshipChanges.length > 0) {
      const rels: Record<string, string> = currentState.relationships || {}
      for (const rc of delta.relationshipChanges) {
        rels[rc.targetEntityId] = rc.newType
      }
      currentState.relationships = rels
    }

    // 处理状态标志
    if (delta.statusFlagChanges) {
      const flags: Record<string, any> = currentState.statusFlags || {}
      for (const [key, val] of Object.entries(delta.statusFlagChanges)) {
        if (val === null) {
          delete flags[key]
        } else {
          flags[key] = val
        }
      }
      currentState.statusFlags = flags
    }

    // 写入（upsert）
    const updated = await prisma.worldState.upsert({
      where: { projectId_entityId: { projectId, entityId: delta.entityId } },
      create: {
        projectId,
        entityId: delta.entityId,
        stateJson: currentState,
        version: newVersion,
      },
      update: {
        stateJson: currentState,
        version: newVersion,
      },
    }) as InternalStateRow

    result.set(delta.entityId, {
      entityId: delta.entityId,
      projectId: updated.projectId,
      ...(typeof updated.stateJson === 'object' ? updated.stateJson : {}),
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
    })
  }

  console.log(`[WorldState] applyStateDelta: ${deltas.length} deltas from ${source}`)
  return result
}

/**
 * 严格合并 —— 校验版本不降级后写入
 * 用于 ConsistencyVerifier 校验通过后的最终提交
 */
export async function mergeStrict(
  projectId: string,
  deltas: StateDelta[],
  expectedVersions: Record<string, number>,
  source: string,
): Promise<Map<string, EntityState>> {
  for (const delta of deltas) {
    const expected = expectedVersions[delta.entityId]
    if (expected !== undefined) {
      const existing = await prisma.worldState.findUnique({
        where: { projectId_entityId: { projectId, entityId: delta.entityId } },
      })
      if (existing && (existing as InternalStateRow).version !== expected) {
        throw new Error(
          `mergeStrict 失败: 实体 ${delta.entityId} 版本冲突 (预期 ${expected}, 实际 ${(existing as InternalStateRow).version})`,
        )
      }
    }
  }
  return applyStateDelta(projectId, deltas, source)
}

/**
 * 初始化实体的世界状态（首次创建时调用）
 */
export async function initEntityState(
  projectId: string,
  entityId: string,
  initialState?: Partial<EntityState>,
): Promise<void> {
  await prisma.worldState.upsert({
    where: { projectId_entityId: { projectId, entityId } },
    create: {
      projectId,
      entityId,
      stateJson: {
        health: initialState?.health ?? '满',
        inventory: initialState?.inventory ?? [],
        location: initialState?.location ?? null,
        relationships: initialState?.relationships ?? {},
        statusFlags: initialState?.statusFlags ?? { isAlive: true },
      },
      version: 1,
    },
    update: {},  // 已存在时不覆盖
  })
}

/**
 * 批量初始化——从已有角色数据迁移到 WorldState
 */
export async function migrateCharactersToWorldState(projectId: string): Promise<number> {
  const entityRows = await prisma.entityRegistry.findMany({ where: { projectId, entityType: 'character' } })
  let count = 0
  for (const entity of entityRows) {
    const existing = await prisma.worldState.findUnique({
      where: { projectId_entityId: { projectId, entityId: entity.id } },
    })
    if (!existing) {
      await initEntityState(projectId, entity.id, {
        statusFlags: { isAlive: true },
      })
      count++
    }
  }
  console.log(`[WorldState] 角色状态迁移: ${count}/${entityRows.length}`)
  return count
}
