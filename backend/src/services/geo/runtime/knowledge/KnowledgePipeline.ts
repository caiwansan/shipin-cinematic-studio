// KMKI-RUNTIME-015 — Knowledge Pipeline
// 统一入口：所有 Agent 通过 Pipeline 写入 Knowledge Object
// 不允许直接操作数据库

import { knowledgeObjectRepository } from './KnowledgeObjectRepository'
import { graphSync } from './GraphSync'
import type { KnowledgeObjectData, KOProvenance, EntitySnapshot, RelationSnapshot, ClaimSnapshot, EvidenceSnapshot, CitationSnapshot } from './KnowledgeObjectSchema'

export class KnowledgePipeline {
  /**
   * Entity Agent 调用：写入实体发现结果
   */
  async onEntityDiscovery(params: {
    projectId: string
    topic: string
    entities: EntitySnapshot[]
    relations: RelationSnapshot[]
    provenance?: KOProvenance
  }): Promise<KnowledgeObjectData> {
    const existing = await knowledgeObjectRepository.findByProjectAndTopic(params.projectId, params.topic)
    if (existing) {
      const updated = await knowledgeObjectRepository.attachEntities(existing.id, params.entities)
      return updated!
    }
    return knowledgeObjectRepository.create({
      projectId: params.projectId,
      topic: params.topic,
      status: 'DISCOVERED',
      entities: params.entities,
      relations: params.relations,
      provenance: params.provenance,
    })
  }

  /**
   * Evidence Agent 调用：附加证据
   */
  async onEvidenceDiscovery(params: {
    projectId: string
    topic: string
    evidence: EvidenceSnapshot[]
    provenance?: KOProvenance
  }): Promise<KnowledgeObjectData | null> {
    const existing = await knowledgeObjectRepository.findByProjectAndTopic(params.projectId, params.topic)
    if (!existing) return null
    return knowledgeObjectRepository.attachEvidence(existing.id, params.evidence)
  }

  /**
   * Claim Agent 调用：附加声明
   */
  async onClaimDiscovery(params: {
    projectId: string
    topic: string
    claims: ClaimSnapshot[]
    provenance?: KOProvenance
  }): Promise<KnowledgeObjectData | null> {
    const existing = await knowledgeObjectRepository.findByProjectAndTopic(params.projectId, params.topic)
    if (!existing) return null
    return knowledgeObjectRepository.attachClaims(existing.id, params.claims)
  }

  /**
   * Citation Agent 调用：附加引用
   */
  async onCitationDiscovery(params: {
    projectId: string
    topic: string
    citations: CitationSnapshot[]
    provenance?: KOProvenance
  }): Promise<KnowledgeObjectData | null> {
    const existing = await knowledgeObjectRepository.findByProjectAndTopic(params.projectId, params.topic)
    if (!existing) return null
    return knowledgeObjectRepository.attachCitations(existing.id, params.citations)
  }

  /**
   * ingestEntityDiscovery — Entity Pipeline Migration entry point (KO-2)
   * 1. Get or create KO by project+topic
   * 2. Merge entities/relations by name
   * 3. Sync to legacy graph (kmki_geo_entities / kmki_geo_entity_relations)
   * 4. Return the KO
   */
  async ingestEntityDiscovery(params: {
    projectId: string
    topic: string
    entities: EntitySnapshot[]
    relations: RelationSnapshot[]
    provenance?: KOProvenance
  }): Promise<KnowledgeObjectData> {
    const ko = await knowledgeObjectRepository.findByProjectAndTopic(params.projectId, params.topic)

    let result: KnowledgeObjectData
    if (ko) {
      // 2a. Merge entities (by name) and relations
      const mergedEntities = this.mergeEntities(ko.entities, params.entities)
      const mergedRelations = this.mergeRelations(ko.relations, params.relations)
      result = {
        ...ko,
        entities: mergedEntities,
        relations: mergedRelations,
        provenance: params.provenance || ko.provenance,
      }
      // Update KO
      await knowledgeObjectRepository.attachEntities(ko.id, mergedEntities)
    } else {
      // 2b. Create new KO
      result = await knowledgeObjectRepository.create({
        projectId: params.projectId,
        topic: params.topic,
        status: 'DISCOVERED',
        entities: params.entities,
        relations: params.relations,
        provenance: params.provenance,
      })
    }

    // 3. Sync to legacy graph (kmki tables)
    await graphSync.syncToGraph(result)

    // 4. Return the KO (fetch fresh from DB)
    return knowledgeObjectRepository.findById(result.id) || result
  }

  private mergeEntities(existing: EntitySnapshot[], incoming: EntitySnapshot[]): EntitySnapshot[] {
    const map = new Map<string, EntitySnapshot>()
    for (const e of existing) map.set(e.name.toLowerCase(), e)
    for (const e of incoming) {
      const key = e.name.toLowerCase()
      if (map.has(key)) {
        const ex = map.get(key)!
        map.set(key, { ...ex, ...e, metadata: { ...ex.metadata, ...e.metadata } })
      } else {
        map.set(key, e)
      }
    }
    return Array.from(map.values())
  }

  private mergeRelations(existing: RelationSnapshot[], incoming: RelationSnapshot[]): RelationSnapshot[] {
    const map = new Map<string, RelationSnapshot>()
    for (const r of existing) {
      map.set(`${r.sourceId}|${r.targetId}|${r.type}`, r)
    }
    for (const r of incoming) {
      const key = `${r.sourceId}|${r.targetId}|${r.type}`
      if (!map.has(key)) {
        map.set(key, r)
      }
    }
    return Array.from(map.values())
  }
}

export const knowledgePipeline = new KnowledgePipeline()
