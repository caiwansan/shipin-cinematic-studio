/**
 * kernel-v1/entity-graph.ts — EntityGraph Store
 *
 * 职责：实体 CRUD + version + 基于 EventLog 重建
 * 定位：EntityGraph = STATE（当前快照，可从 EventLog 重建）
 * 范围：v1 用内存 store，后续切到 entity_graph 表
 */

import crypto from 'crypto'
import { KernelCommand, EntityNode, EntityGraph } from './types.js'
import { prisma } from '../utils/index.js'
import { EventLogStore } from './event-log.js'

export class EntityGraphStore {
  /** v1 先用内存 store */
  private graphs: Map<string, EntityGraph> = new Map()
  private eventLog: EventLogStore

  constructor(eventLog: EventLogStore) {
    this.eventLog = eventLog
  }

  async apply(cmd: KernelCommand): Promise<any> {
    switch (cmd.type) {
      case 'ENTITY_CREATE':
        return this.create(cmd)
      case 'ENTITY_UPDATE':
        return this.update(cmd)
      case 'ENTITY_DELETE':
        return this.delete(cmd)
      case 'ENTITY_REGENERATE':
        return this.regenerate(cmd)
      case 'ENTITY_BATCH_CREATE':
        return this.batchCreate(cmd)
      default:
        throw new Error(`[EntityGraph] unknown type: ${cmd.type}`)
    }
  }

  private getOrCreateGraph(projectId: string): EntityGraph {
    let graph = this.graphs.get(projectId)
    if (!graph) {
      graph = {
        entities: new Map(),
        projectId,
        version: 0,
      }
      this.graphs.set(projectId, graph)
    }
    return graph
  }

  private key(type: string, id: string): string {
    return `${type}:${id}`
  }

  private async create(cmd: KernelCommand): Promise<EntityNode> {
    const { projectId, entityType, data } = cmd.payload
    if (!entityType) throw new Error('[EntityGraph] create requires entityType')
    
    const graph = this.getOrCreateGraph(projectId)
    const id = crypto.randomUUID()
    
    const node: EntityNode = {
      id,
      projectId,
      type: entityType,
      version: 1,
      data: data ?? {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
    }

    graph.entities.set(this.key(entityType, id), node)
    graph.version++

    // 写 DB（异步，表可能不存在，非致命）
    try {
      await (prisma as any).entityGraphNode?.create({
        data: {
          id,
          projectId,
          type: entityType,
          version: 1,
          spec: data ?? {},
        },
      })
    } catch (err) {
      console.warn('[EntityGraph] DB write failed (non-fatal):', (err as Error).message)
    }

    return node
  }

  private async update(cmd: KernelCommand): Promise<EntityNode | null> {
    const { projectId, entityType, entityId, diff } = cmd.payload
    if (!entityType || !entityId) throw new Error('[EntityGraph] update requires entityType + entityId')

    const graph = this.getOrCreateGraph(projectId)
    const key = this.key(entityType, entityId)
    const existing = graph.entities.get(key)
    if (!existing) throw new Error(`[EntityGraph] entity not found: ${key}`)

    existing.data = { ...existing.data, ...diff }
    existing.version++
    existing.updatedAt = Date.now()
    graph.version++

    return existing
  }

  private async delete(cmd: KernelCommand): Promise<boolean> {
    const { projectId, entityType, entityId } = cmd.payload
    if (!entityType || !entityId) throw new Error('[EntityGraph] delete requires entityType + entityId')

    const graph = this.getOrCreateGraph(projectId)
    const key = this.key(entityType, entityId)
    const existed = graph.entities.has(key)
    graph.entities.delete(key)
    graph.version++

    return existed
  }

  private async regenerate(cmd: KernelCommand): Promise<EntityNode> {
    const { projectId, entityType, entityId, data } = cmd.payload
    if (!entityType || !entityId) throw new Error('[EntityGraph] regenerate requires entityType + entityId')

    const graph = this.getOrCreateGraph(projectId)
    const key = this.key(entityType, entityId)
    const existing = graph.entities.get(key)
    
    if (!existing) {
      // 不存在则创建
      return this.create(cmd)
    }

    existing.data = data ?? existing.data
    existing.version++
    existing.updatedAt = Date.now()
    graph.version++

    return existing
  }

  private async batchCreate(cmd: KernelCommand): Promise<EntityNode[]> {
    const { projectId, batch } = cmd.payload
    if (!batch || !Array.isArray(batch)) throw new Error('[EntityGraph] batchCreate requires batch array')

    const results: EntityNode[] = []
    for (const item of batch) {
      const result = await this.create({
        ...cmd,
        payload: { projectId, entityType: item.entityType, data: item.data },
      })
      results.push(result)
    }
    return results
  }

  // === 读接口 ===

  async getEntity(projectId: string, type: string, id: string): Promise<EntityNode | null> {
    const graph = this.graphs.get(projectId)
    if (!graph) return null
    return graph.entities.get(this.key(type, id)) ?? null
  }

  async getByType(projectId: string, type: string): Promise<EntityNode[]> {
    const graph = this.graphs.get(projectId)
    if (!graph) return []
    return Array.from(graph.entities.values()).filter(e => e.type === type)
  }

  async getAll(projectId: string): Promise<EntityNode[]> {
    const graph = this.graphs.get(projectId)
    if (!graph) return []
    return Array.from(graph.entities.values())
  }

  async getVersion(projectId: string): Promise<number> {
    const graph = this.graphs.get(projectId)
    return graph?.version ?? 0
  }

  // === Diff Support (v1.1 Causal Layer) ===

  /**
   * 返回当前项目所有 entity 的 ID + type 快照
   * 用于因果链 diff 追踪
   */
  snapshotIds(projectId: string): Record<string, { id: string; type: string; data: any }> {
    const graph = this.graphs.get(projectId)
    if (!graph) return {}
    const snapshot: Record<string, { id: string; type: string; data: any }> = {}
    for (const [key, entity] of graph.entities.entries()) {
      snapshot[key] = { id: entity.id, type: entity.type, data: { ...entity.data } }
    }
    return snapshot
  }

  /**
   * 清空指定项目的所有 entity 数据
   * 用于 reconstruction replay
   */
  clearProject(projectId: string): void {
    this.graphs.delete(projectId)
  }

  // === 基于 EventLog 重建（MVEL 验证核心） ===

  /**
   * 从 EventLog 重建 EntityGraph
   * 
   * 这是 Kernel 是否成立的唯一验证标准：
   * rebuildProjectState() = replay(event_log) → reconstruct entity_graph
   */
  async rebuildFromEventLog(projectId: string): Promise<EntityGraph> {
    const events = await this.eventLog.replay(projectId)
    
    const graph: EntityGraph = {
      entities: new Map(),
      projectId,
      version: 0,
    }

    for (const event of events) {
      const { type, payload } = event

      switch (type) {
        case 'ENTITY_CREATE': {
          if (payload.entityType && payload.data) {
            const id = payload.entityId ?? crypto.randomUUID()
            graph.entities.set(this.key(payload.entityType, id), {
              id,
              projectId,
              type: payload.entityType,
              version: 1,
              data: payload.data,
              createdAt: event.timestamp,
              updatedAt: event.timestamp,
              tags: [],
            })
            graph.version++
          }
          break
        }
        case 'ENTITY_UPDATE': {
          if (payload.entityType && payload.entityId && payload.diff) {
            const key = this.key(payload.entityType, payload.entityId)
            const existing = graph.entities.get(key)
            if (existing) {
              existing.data = { ...existing.data, ...payload.diff }
              existing.version++
              existing.updatedAt = event.timestamp
              graph.version++
            }
          }
          break
        }
        case 'ENTITY_DELETE': {
          if (payload.entityType && payload.entityId) {
            graph.entities.delete(this.key(payload.entityType, payload.entityId))
            graph.version++
          }
          break
        }
        case 'ENTITY_BATCH_CREATE': {
          const batch = payload.batch ?? payload.data?.batch
          if (Array.isArray(batch)) {
            for (const item of batch) {
              const id = crypto.randomUUID()
              graph.entities.set(this.key(item.entityType ?? 'unknown', id), {
                id,
                projectId,
                type: item.entityType ?? 'unknown',
                version: 1,
                data: item.data ?? {},
                createdAt: event.timestamp,
                updatedAt: event.timestamp,
                tags: [],
              })
              graph.version++
            }
          }
          break
        }
      }
    }

    return graph
  }
}
