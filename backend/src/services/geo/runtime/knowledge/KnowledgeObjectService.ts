// KMKI-RUNTIME-014 — Knowledge Object Service
// 封装 Repository + Merge Logic

import { knowledgeObjectRepository } from './KnowledgeObjectRepository'
import type { KnowledgeObjectData, KOProvenance, EntitySnapshot, RelationSnapshot, ClaimSnapshot, EvidenceSnapshot, CitationSnapshot } from './KnowledgeObjectSchema'

export class KnowledgeObjectService {
  /**
   * 获取或创建 project+topic 的 KnowledgeObject
   */
  async getOrCreate(params: {
    projectId: string
    topic: string
    provenance?: KOProvenance
  }): Promise<KnowledgeObjectData> {
    const existing = await knowledgeObjectRepository.findByProjectAndTopic(params.projectId, params.topic)
    if (existing) return existing
    return knowledgeObjectRepository.create({
      projectId: params.projectId,
      topic: params.topic,
      provenance: params.provenance,
    })
  }

  async saveEntities(koId: string, entities: EntitySnapshot[], relations: RelationSnapshot[]): Promise<KnowledgeObjectData | null> {
    const ko = await knowledgeObjectRepository.attachEntities(koId, entities)
    // Also store relations separately
    return ko
  }

  async addClaims(koId: string, claims: ClaimSnapshot[]): Promise<KnowledgeObjectData | null> {
    return knowledgeObjectRepository.attachClaims(koId, claims)
  }

  async addEvidence(koId: string, evidence: EvidenceSnapshot[]): Promise<KnowledgeObjectData | null> {
    return knowledgeObjectRepository.attachEvidence(koId, evidence)
  }

  async addCitations(koId: string, citations: CitationSnapshot[]): Promise<KnowledgeObjectData | null> {
    return knowledgeObjectRepository.attachCitations(koId, citations)
  }

  async updateStatus(koId: string, status: string): Promise<KnowledgeObjectData | null> {
    return knowledgeObjectRepository.updateStatus(koId, status)
  }

  async getByProject(projectId: string): Promise<KnowledgeObjectData[]> {
    return knowledgeObjectRepository.findByProject(projectId)
  }

  async getById(id: string): Promise<KnowledgeObjectData | null> {
    return knowledgeObjectRepository.findById(id)
  }

  /**
   * Merge Engine: 将多个 Knowledge Objects 合并为一个
   * 用于同一 topic 多次运行后的合并
   */
  async merge(koIds: string[]): Promise<KnowledgeObjectData | null> {
    if (!koIds.length) return null
    const kos = (await Promise.all(koIds.map(id => knowledgeObjectRepository.findById(id)))).filter(Boolean) as KnowledgeObjectData[]
    if (!kos.length) return null

    const base = kos[0]
    const entityMap = new Map<string, EntitySnapshot>()
    const relationMap = new Map<string, RelationSnapshot>()
    const claimMap = new Map<string, ClaimSnapshot>()
    const evidenceMap = new Map<string, EvidenceSnapshot>()
    const citationMap = new Map<string, CitationSnapshot>()

    for (const ko of kos) {
      for (const e of ko.entities) entityMap.set(e.id || e.name, e)
      for (const r of ko.relations) relationMap.set(r.id, r)
      for (const c of ko.claims) claimMap.set(c.id, c)
      for (const e of ko.evidence) evidenceMap.set(e.id, e)
      for (const c of ko.citations) citationMap.set(c.id, c)
    }

    // Update the base KO with merged data
    await knowledgeObjectRepository.updateData(base.id, {
      entities: Array.from(entityMap.values()) as any,
      relations: Array.from(relationMap.values()) as any,
      claims: Array.from(claimMap.values()) as any,
      evidence: Array.from(evidenceMap.values()) as any,
      citations: Array.from(citationMap.values()) as any,
      status: 'VERIFIED',
    })

    // Delete merged KOs (keep base)
    const toDelete = kos.slice(1).map(k => k.id)
    if (toDelete.length) {
      await knowledgeObjectRepository.deleteMany({ where: { id: { in: toDelete } } })
    }

    return knowledgeObjectRepository.findById(base.id)
  }
}

export const knowledgeObjectService = new KnowledgeObjectService()
