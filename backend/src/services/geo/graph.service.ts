// ============================================================
// Brand GEO — Graph Service
// CRUD operations for GeoGraphNode and GeoGraphEdge
// Phase 3: Graph Builder upgraded — consumes Semantic Runtime instead of raw Assets
// Flow: Semantic Runtime → Knowledge Graph (Node = Entity, Edge = SemanticRelation)
// Graph no longer self-identifies entities
// ============================================================

import { prisma } from '../../utils/index.js'
import { entityRepository } from '../semantic/repositories/entity.repository.js'
import { relationRepository } from '../semantic/repositories/relation.repository.js'

export const geoGraphService = {
  // ─── Nodes ───

  async listNodes(projectId: string) {
    return prisma.geoGraphNode.findMany({
      where: { projectId },
      include: { outgoing: true, incoming: true },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getNode(id: string) {
    return prisma.geoGraphNode.findUnique({
      where: { id },
      include: { outgoing: true, incoming: true },
    })
  },

  async createNode(data: {
    projectId: string
    type: string
    label: string
    properties?: string
  }) {
    return prisma.geoGraphNode.create({
      data: {
        ...data,
        schemaVersion: 1,
      },
    })
  },

  async updateNode(id: string, data: {
    type?: string
    label?: string
    properties?: string
  }) {
    return prisma.geoGraphNode.update({
      where: { id },
      data,
    })
  },

  async deleteNode(id: string) {
    return prisma.geoGraphNode.delete({ where: { id } })
  },

  // ─── Edges ───

  async listEdges(projectId: string) {
    return prisma.geoGraphEdge.findMany({
      where: {
        OR: [
          { source: { projectId } },
          { target: { projectId } },
        ],
      },
      include: { source: true, target: true },
      orderBy: { createdAt: 'desc' },
    })
  },

  async createEdge(data: {
    sourceId: string
    targetId: string
    type: string
    properties?: string
  }) {
    return prisma.geoGraphEdge.create({
      data: {
        ...data,
        schemaVersion: 1,
      },
    })
  },

  async deleteEdge(id: string) {
    return prisma.geoGraphEdge.delete({ where: { id } })
  },

  // ─── Phase 3: Build graph from Semantic Runtime ───

  /**
   * Build knowledge graph from Semantic Runtime data
   * Nodes = SemanticEntity, Edges = SemanticRelation
   * Graph no longer self-identifies entities
   */
  async buildFromSemantic(projectId: string) {
    // 1. Get all entities for the project
    const { items: entities } = await entityRepository.list({ projectId, limit: 1000 })

    const entityNodeMap = new Map<string, string>() // entityId -> nodeId

    for (const entity of entities) {
      const nodeType = this.entityTypeToNodeType(entity.type)
      const nodeLabel = entity.name

      // Check if node already exists
      const existingNode = await prisma.geoGraphNode.findFirst({
        where: { projectId, label: nodeLabel, type: nodeType },
      })

      if (existingNode) {
        entityNodeMap.set(entity.id, existingNode.id)
        continue
      }

      // Create new node from semantic entity
      const node = await prisma.geoGraphNode.create({
        data: {
          projectId,
          type: nodeType,
          label: nodeLabel,
          properties: JSON.stringify({
            entityId: entity.id,
            description: entity.description,
            confidence: entity.confidence,
            aliases: (entity as any).aliases?.map((a: any) => a.alias) || [],
          }),
          schemaVersion: 1,
        },
      })
      entityNodeMap.set(entity.id, node.id)
    }

    // 2. Create edges from semantic relations
    const { items: relations } = await relationRepository.list({ projectId, limit: 1000 })
    let edgeCount = 0

    for (const rel of relations) {
      if (!rel.fromEntityId || !rel.toEntityId) continue
      const sourceNodeId = entityNodeMap.get(rel.fromEntityId)
      const targetNodeId = entityNodeMap.get(rel.toEntityId)
      if (sourceNodeId && targetNodeId) {
        try {
          await prisma.geoGraphEdge.create({
            data: {
              sourceId: sourceNodeId,
              targetId: targetNodeId,
              type: rel.relation || 'related_to',
              properties: JSON.stringify({
                relationId: rel.id,
                confidence: rel.confidence,
              }),
              schemaVersion: 1,
            },
          })
          edgeCount++
        } catch {
          // Skip duplicates
        }
      }
    }

    return {
      nodeCount: entityNodeMap.size,
      edgeCount,
    }
  },

  /**
   * Legacy build from assets — now delegates to semantic build
   * @deprecated Use buildFromSemantic instead
   */
  async buildFromAssets(projectId: string) {
    return this.buildFromSemantic(projectId)
  },

  entityTypeToNodeType(type: string): string {
    const map: Record<string, string> = {
      Brand: 'brand',
      Company: 'organization',
      Organization: 'organization',
      Person: 'person',
      Product: 'product',
      Service: 'service',
      Feature: 'feature',
      Capability: 'capability',
      Workflow: 'process',
      Prompt: 'prompt',
      API: 'api',
      Document: 'document',
      Technology: 'technology',
      Concept: 'concept',
      Location: 'location',
      Event: 'event',
    }
    return map[type] || 'concept'
  },
}
