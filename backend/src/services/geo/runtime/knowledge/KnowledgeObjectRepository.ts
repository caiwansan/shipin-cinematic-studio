// KMKI-RUNTIME-013 — Knowledge Object Repository

import { prisma } from '../../../../utils/index'
import type { KnowledgeObjectData, KOStatus, KOProvenance, EntitySnapshot, RelationSnapshot, ClaimSnapshot, EvidenceSnapshot, CitationSnapshot } from './KnowledgeObjectSchema'

interface PrismaKO {
  id: string
  projectId: string
  workflowId: string | null
  topic: string | null
  status: string
  confidence: number | null
  qualityScore: number | null
  provenance: any
  metadata: any
  entities: any
  relations: any
  claims: any
  evidence: any
  citations: any
  createdAt: Date
  updatedAt: Date
}

export class KnowledgeObjectRepository {
  async findById(id: string): Promise<KnowledgeObjectData | null> {
    const ko = await prisma.knowledgeObject.findUnique({ where: { id } })
    return ko ? this.mapKO(ko) : null
  }

  async findByProject(projectId: string): Promise<KnowledgeObjectData[]> {
    const kos = await prisma.knowledgeObject.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    })
    return kos.map(this.mapKO)
  }

  async findByProjectAndTopic(projectId: string, topic: string): Promise<KnowledgeObjectData | null> {
    const ko = await prisma.knowledgeObject.findFirst({
      where: { projectId, topic },
      orderBy: { updatedAt: 'desc' },
    })
    return ko ? this.mapKO(ko) : null
  }

  async create(data: {
    projectId: string
    workflowId?: string
    topic?: string
    status?: string
    provenance?: KOProvenance
    entities?: EntitySnapshot[]
    relations?: RelationSnapshot[]
    claims?: ClaimSnapshot[]
    evidence?: EvidenceSnapshot[]
    citations?: CitationSnapshot[]
  }): Promise<KnowledgeObjectData> {
    const ko = await prisma.knowledgeObject.create({
      data: {
        projectId: data.projectId,
        workflowId: data.workflowId || null,
        topic: data.topic || null,
        status: data.status || 'DISCOVERED',
        provenance: (data.provenance as any) || null,
        entities: (data.entities as any) || [],
        relations: (data.relations as any) || [],
        claims: (data.claims as any) || [],
        evidence: (data.evidence as any) || [],
        citations: (data.citations as any) || [],
        metadata: {},
      },
    })
    return this.mapKO(ko)
  }

  async updateStatus(id: string, status: string): Promise<KnowledgeObjectData | null> {
    const ko = await prisma.knowledgeObject.update({
      where: { id },
      data: { status },
    })
    return ko ? this.mapKO(ko) : null
  }

  async attachEntities(id: string, entities: EntitySnapshot[]): Promise<KnowledgeObjectData | null> {
    const existing = await prisma.knowledgeObject.findUnique({ where: { id } })
    if (!existing) return null
    const current = (existing.entities as any[]) || []
    const merged = this.mergeByKey(current, entities, 'id')
    const ko = await prisma.knowledgeObject.update({
      where: { id },
      data: { entities: merged as any },
    })
    return this.mapKO(ko)
  }

  async attachClaims(id: string, claims: ClaimSnapshot[]): Promise<KnowledgeObjectData | null> {
    const existing = await prisma.knowledgeObject.findUnique({ where: { id } })
    if (!existing) return null
    const current = (existing.claims as any[]) || []
    const merged = this.mergeByKey(current, claims, 'id')
    const ko = await prisma.knowledgeObject.update({
      where: { id },
      data: { claims: merged as any, status: 'ENRICHING' },
    })
    return this.mapKO(ko)
  }

  async attachEvidence(id: string, evidence: EvidenceSnapshot[]): Promise<KnowledgeObjectData | null> {
    const existing = await prisma.knowledgeObject.findUnique({ where: { id } })
    if (!existing) return null
    const current = (existing.evidence as any[]) || []
    const merged = this.mergeByKey(current, evidence, 'id')
    const ko = await prisma.knowledgeObject.update({
      where: { id },
      data: { evidence: merged as any },
    })
    return this.mapKO(ko)
  }

  async attachCitations(id: string, citations: CitationSnapshot[]): Promise<KnowledgeObjectData | null> {
    const existing = await prisma.knowledgeObject.findUnique({ where: { id } })
    if (!existing) return null
    const current = (existing.citations as any[]) || []
    const merged = this.mergeByKey(current, citations, 'id')
    const ko = await prisma.knowledgeObject.update({
      where: { id },
      data: { citations: merged as any },
    })
    return this.mapKO(ko)
  }

  private mergeByKey(existing: any[], incoming: any[], key: string): any[] {
    const map = new Map(existing.map((e: any) => [e[key], e]))
    for (const item of incoming) {
      map.set(item[key], { ...(map.get(item[key]) || {}), ...item })
    }
    return Array.from(map.values())
  }

  private mapKO(ko: PrismaKO): KnowledgeObjectData {
    return {
      id: ko.id,
      projectId: ko.projectId,
      workflowId: ko.workflowId,
      topic: ko.topic,
      status: ko.status as any,
      confidence: ko.confidence,
      qualityScore: ko.qualityScore,
      provenance: ko.provenance as any,
      entities: (ko.entities || []) as EntitySnapshot[],
      relations: (ko.relations || []) as RelationSnapshot[],
      claims: (ko.claims || []) as ClaimSnapshot[],
      evidence: (ko.evidence || []) as EvidenceSnapshot[],
      citations: (ko.citations || []) as CitationSnapshot[],
      createdAt: ko.createdAt.toISOString(),
      updatedAt: ko.updatedAt.toISOString(),
    }
  }

  async updateData(id: string, data: any): Promise<KnowledgeObjectData | null> {
    const ko = await prisma.knowledgeObject.update({
      where: { id },
      data,
    })
    return ko ? this.mapKO(ko) : null
  }

  async deleteMany(where: any): Promise<void> {
    await prisma.knowledgeObject.deleteMany({ where })
  }
}

export const knowledgeObjectRepository = new KnowledgeObjectRepository()
