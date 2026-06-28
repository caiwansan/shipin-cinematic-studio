// ============================================================
// Brand GEO — Graph Service
// CRUD operations for GeoGraphNode and GeoGraphEdge
// ============================================================

import { prisma } from '../../utils/index.js'

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
    // Cascade deletes edges
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
}
