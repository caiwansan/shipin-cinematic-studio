// ============================================================
// GEO Entity Service — Entity CRUD + Provenance
// ============================================================

import { prisma } from '../../../utils/index'
import { EntityType, createProvenanceRecord, createLineageRecord } from '../types'
import type { Entity, EntityRelation, ResearchOutput } from '../types'
import { executeEntityDiscovery } from '../agents/entity.agent'

function mapPrismaEntity(e: any): Entity {
  return {
    id: e.id,
    projectId: e.projectId,
    name: e.name,
    type: e.type as EntityType,
    description: e.description || undefined,
    metadata: e.metadata || undefined,
    provenance: typeof e.provenance === 'string' ? JSON.parse(e.provenance) : e.provenance,
    sortOrder: e.sortOrder,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

function mapPrismaRelation(r: any): EntityRelation {
  return {
    id: r.id,
    projectId: r.projectId,
    sourceId: r.sourceId,
    targetId: r.targetId,
    type: r.type,
    lineage: typeof r.lineage === 'string' ? JSON.parse(r.lineage) : r.lineage,
    metadata: r.metadata || undefined,
    createdAt: r.createdAt.toISOString(),
  }
}

export const geoEntityService = {
  /**
   * Discover entities for a project based on topic research.
   * Calls Entity Agent via Agent Dispatcher.
   */
  async discoverEntities(projectId: string, topic: ResearchOutput | string): Promise<{ entities: Entity[]; relations: EntityRelation[] }> {
    const project = await prisma.gEOProject.findUnique({ where: { id: projectId } })
    if (!project) throw new Error('Project not found')

    // Normalize input to ResearchOutput
    const research: ResearchOutput = typeof topic === 'string'
      ? {
          primaryTopic: topic,
          secondaryTopics: [],
          questions: [],
          competitors: [],
          keywords: [],
        }
      : topic

    // Execute entity discovery via Agent Dispatcher
    const discoveryResult = await executeEntityDiscovery({
      research,
      config: { maxEntities: 10 },
    })

    const createdEntities: Entity[] = []
    const createdRelations: EntityRelation[] = []

    // Create entities in DB
    for (const entityInput of discoveryResult.entities) {
      const provenance = entityInput.provenance || createProvenanceRecord({
        source: 'geo.entity',
        action: 'created',
        actor: 'agent:geo.entity',
        reason: `Entity discovery for topic: ${research.primaryTopic}`,
      })

      const entity = await prisma.gEOEntity.create({
        data: {
          projectId,
          name: entityInput.name,
          type: entityInput.type,
          description: entityInput.description || '',
          metadata: JSON.parse(JSON.stringify(entityInput.metadata || {})),
          provenance: provenance as any,
          sortOrder: entityInput.sortOrder || 0,
        },
      })
      createdEntities.push(mapPrismaEntity(entity))
    }

    // Build a name→id map for relation resolution
    const nameToId = new Map<string, string>()
    for (const e of createdEntities) {
      nameToId.set(e.name, e.id)
    }

    // Create relations
    for (const relationInput of discoveryResult.relations) {
      const sourceId = nameToId.get(relationInput.sourceId) || relationInput.sourceId
      const targetId = nameToId.get(relationInput.targetId) || relationInput.targetId

      const lineage = relationInput.lineage || createLineageRecord(
        createdEntities.find((e) => e.id === sourceId)?.name || sourceId,
        createdEntities.find((e) => e.id === targetId)?.name || targetId,
        relationInput.type,
      )

      const relation = await prisma.gEOEntityRelation.create({
        data: {
          projectId,
          sourceId,
          targetId,
          type: relationInput.type || 'related_to',
          lineage: lineage as any,
          metadata: JSON.parse(JSON.stringify(relationInput.metadata || {})),
        },
      })
      createdRelations.push(mapPrismaRelation(relation))
    }

    return { entities: createdEntities, relations: createdRelations }
  },

  /**
   * Get a single entity by ID with provenance.
   */
  async getEntity(id: string): Promise<Entity | null> {
    const entity = await prisma.gEOEntity.findUnique({ where: { id } })
    if (!entity) return null
    return mapPrismaEntity(entity)
  },

  /**
   * List all entities for a project.
   */
  async listEntities(projectId: string): Promise<Entity[]> {
    const entities = await prisma.gEOEntity.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    })
    return entities.map(mapPrismaEntity)
  },

  /**
   * Update an entity.
   */
  async updateEntity(id: string, data: Partial<Entity>): Promise<Entity | null> {
    const existing = await prisma.gEOEntity.findUnique({ where: { id } })
    if (!existing) return null

    // Generate provenance for update
    const existingProvenance = typeof existing.provenance === 'string'
      ? JSON.parse(existing.provenance)
      : existing.provenance

    const updatedProvenance = createProvenanceRecord({
      source: existingProvenance.source || 'geo.entity',
      action: 'updated',
      actor: 'user:manual',
      timestamp: new Date().toISOString(),
      reason: data.provenance?.reason || 'Manual update',
      previousVersionId: id,
    })

    const entity = await prisma.gEOEntity.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
        provenance: updatedProvenance as any,
      },
    })
    return mapPrismaEntity(entity)
  },

  /**
   * Add a relation between two entities with auto-generated lineage.
   */
  async addRelation(
    sourceId: string,
    targetId: string,
    type: string,
    metadata?: Record<string, unknown>,
  ): Promise<EntityRelation> {
    // Get entities to build lineage
    const [source, target] = await Promise.all([
      prisma.gEOEntity.findUnique({ where: { id: sourceId } }),
      prisma.gEOEntity.findUnique({ where: { id: targetId } }),
    ])

    if (!source || !target) {
      throw new Error('Source or target entity not found')
    }

    const lineage = createLineageRecord(source.name, target.name, type)

    const relation = await prisma.gEOEntityRelation.create({
      data: {
        projectId: source.projectId,
        sourceId,
        targetId,
        type,
        lineage: lineage as any,
        metadata: (metadata || {}) as any,
      },
    })

    return mapPrismaRelation(relation)
  },

  /**
   * Get all relations for an entity.
   */
  async getEntityRelations(entityId: string): Promise<EntityRelation[]> {
    const relations = await prisma.gEOEntityRelation.findMany({
      where: {
        OR: [{ sourceId: entityId }, { targetId: entityId }],
      },
    })
    return relations.map(mapPrismaRelation)
  },

  /**
   * Get the full provenance chain for an entity.
   */
  async getEntityProvenance(entityId: string): Promise<{ current: Entity; provenanceChain: any[] } | null> {
    const entity = await prisma.gEOEntity.findUnique({ where: { id: entityId } })
    if (!entity) return null

    const provenance = typeof entity.provenance === 'string'
      ? JSON.parse(entity.provenance)
      : entity.provenance

    // Build provenance chain from update history
    // In Sprint 1A, we track provenance via the JSON field.
    // Future sprints will add a ProvenanceEvent model for full chain tracking.
    const chain = [{
      action: provenance.action,
      actor: provenance.actor,
      timestamp: provenance.timestamp,
      reason: provenance.reason,
      source: provenance.source,
    }]

    return {
      current: mapPrismaEntity(entity),
      provenanceChain: chain,
    }
  },
}
