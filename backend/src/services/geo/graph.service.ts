// ============================================================
// Brand GEO — Graph Service
// CRUD operations for GeoGraphNode and GeoGraphEdge
// Phase 2.5: Graph Builder reads Assets for entity creation
// ============================================================

import { prisma } from '../../utils/index.js'
import { assetRepository } from '../asset/repositories/asset.repository.js'

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

  // ─── Phase 2.5: Build graph from assets ───

  /**
   * Build knowledge graph nodes from Unified Assets
   * Each asset type becomes a node type
   */
  async buildFromAssets(projectId: string) {
    const { items: assets } = await assetRepository.list({ projectId, limit: 500 })

    const nodeMap = new Map<string, string>() // assetId -> nodeId

    for (const asset of assets) {
      // Convert asset type to graph node type
      const nodeType = this.assetTypeToNodeType(asset.type)
      const nodeLabel = asset.title

      // Check if node already exists for this asset
      const existingNode = await prisma.geoGraphNode.findFirst({
        where: { projectId, label: nodeLabel, type: nodeType },
      })

      if (existingNode) {
        nodeMap.set(asset.id, existingNode.id)
        continue
      }

      // Create new node
      const node = await prisma.geoGraphNode.create({
        data: {
          projectId,
          type: nodeType,
          label: nodeLabel,
          properties: JSON.stringify({
            assetId: asset.id,
            source: asset.source,
            sourceUrl: asset.sourceUrl,
            summary: asset.summary,
            language: asset.language,
            status: asset.status,
          }),
          schemaVersion: 1,
        },
      })
      nodeMap.set(asset.id, node.id)
    }

    // Create edges between related assets (by source domain)
    await this.buildEdgesFromAssets(projectId, assets, nodeMap)

    return { nodeCount: nodeMap.size }
  },

  async buildEdgesFromAssets(projectId: string, assets: any[], nodeMap: Map<string, string>) {
    // Group assets by source domain
    const domainGroups = new Map<string, string[]>()
    for (const asset of assets) {
      if (!asset.sourceUrl) continue
      try {
        const domain = new URL(asset.sourceUrl).hostname
        if (!domainGroups.has(domain)) domainGroups.set(domain, [])
        domainGroups.get(domain)!.push(asset.id)
      } catch {
        // Skip invalid URLs
      }
    }

    // Create edges between assets sharing the same domain
    let edgeCount = 0
    for (const [, assetIds] of domainGroups) {
      if (assetIds.length < 2) continue
      for (let i = 1; i < assetIds.length && edgeCount < 100; i++) {
        const fromNodeId = nodeMap.get(assetIds[0])
        const toNodeId = nodeMap.get(assetIds[i])
        if (fromNodeId && toNodeId) {
          try {
            await prisma.geoGraphEdge.create({
              data: {
                sourceId: fromNodeId,
                targetId: toNodeId,
                type: 'related_to',
                properties: JSON.stringify({ domain: domainGroups }),
                schemaVersion: 1,
              },
            })
            edgeCount++
          } catch {
            // Skip duplicates
          }
        }
      }
    }
  },

  assetTypeToNodeType(type: string): string {
    const map: Record<string, string> = {
      Brand: 'brand',
      Website: 'page',
      LandingPage: 'page',
      Article: 'article',
      Blog: 'article',
      News: 'article',
      FAQ: 'faq',
      Glossary: 'concept',
      WhitePaper: 'document',
      CaseStudy: 'case_study',
      Guide: 'guide',
      Tutorial: 'guide',
      API: 'api',
      Document: 'document',
      Feature: 'product',
      Pricing: 'page',
      Service: 'service',
      Product: 'product',
      Image: 'image',
      Video: 'media',
      Logo: 'brand',
      Schema: 'schema',
      JSONLD: 'schema',
      SocialPost: 'social',
      PDF: 'document',
      Markdown: 'document',
    }
    return map[type] || 'concept'
  },
}
