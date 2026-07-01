// KMKI-RUNTIME-017 — GraphSync
// 从 KnowledgeObject 同步到 Legacy Graph（kmki_geo_entities / kmki_geo_entity_relations）
// 这是唯一的 Graph 更新入口

import { geoEntityRepository } from '../../repositories/geo-entity.repository.js'
import { geoEntityRelationRepository } from '../../repositories/geo-entity-relation.repository.js'
import type { KnowledgeObjectData, EntitySnapshot, RelationSnapshot } from './KnowledgeObjectSchema'

export class GraphSync {
  /**
   * 将 KO 中的 entities/relations 同步到 graph 表
   */
  async syncToGraph(ko: KnowledgeObjectData): Promise<{ entities: number; relations: number }> {
    let entityCount = 0
    let relationCount = 0

    for (const entity of ko.entities) {
      await this.upsertEntity(ko.projectId, entity, ko.provenance)
      entityCount++
    }

    for (const relation of ko.relations) {
      await this.upsertRelation(ko.projectId, relation, ko.provenance)
      relationCount++
    }

    return { entities: entityCount, relations: relationCount }
  }

  /**
   * 从 KO 删除已移除的 entities（软删除）
   */
  async removeOrphanedEntities(ko: KnowledgeObjectData, previousEntityIds: string[]): Promise<number> {
    const currentIds = new Set(ko.entities.map(e => e.id))
    const removed = previousEntityIds.filter(id => !currentIds.has(id))
    if (removed.length === 0) return 0

    await geoEntityRepository.updateMany(
      { id: { in: removed } },
      { metadata: { removed: true, removedAt: new Date().toISOString() } as any }
    )
    return removed.length
  }

  private async upsertEntity(projectId: string, entity: EntitySnapshot, provenance: any): Promise<void> {
    const existing = await geoEntityRepository.findFirst(
      { projectId, name: entity.name }
    )

    if (existing) {
      // 更新已有实体（合并 provenance）
      const existingProvenance = (existing.provenance as any) || {}
      await geoEntityRepository.update(
        { id: existing.id },
        {
          type: entity.type,
          description: entity.description || existing.description,
          metadata: (entity.metadata || existing.metadata) as any,
          provenance: { ...existingProvenance, lastUpdatedBy: provenance } as any,
        }
      )
    } else {
      await geoEntityRepository.create({
        projectId,
        name: entity.name,
        type: entity.type,
        description: entity.description || '',
        metadata: (entity.metadata || {}) as any,
        provenance: { source: 'knowledge-object', original: provenance } as any,
        sortOrder: 0,
      })
    }
  }

  private async upsertRelation(projectId: string, relation: RelationSnapshot, provenance: any): Promise<void> {
    // Check if relation already exists
    const existing = await geoEntityRelationRepository.findFirst({
      projectId,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      type: relation.type,
    })

    if (!existing) {
      await geoEntityRelationRepository.create({
        projectId,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        type: relation.type,
        metadata: (relation.metadata || {}) as any,
        lineage: { source: 'knowledge-object' } as any,
      }).catch(() => {
        // 可能外键约束或重复，忽略
      })
    }
  }
}

export const graphSync = new GraphSync()
