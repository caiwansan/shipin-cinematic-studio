/**
 * D1-2 Temporal Graph Engine — 时间图谱引擎
 *
 * 从 ContinuityLinks 重建时间线
 * 兼容现有 Prisma ContinuityLink schema
 */

import { continuityLinkEngine, ContinuityLinkType } from './continuity-link.service.js'
import { prisma } from '../utils/index.js'

export interface TemporalNode {
  segmentId: string
  type: string
  order: number
}

export interface TimelineGraph {
  nodes: TemporalNode[]
  edges: { from: string; to: string; linkType: string }[]
  adjacency: Record<string, string[]>
}

export class TemporalGraphEngine {
  /**
   * 重建项目时间线
   */
  async rebuildTimeline(projectId: string): Promise<TimelineGraph> {
    const { links, adjacency } = await continuityLinkEngine.getProjectGraph(projectId)

    const nodes: TemporalNode[] = []
    const seen = new Set<string>()

    for (const link of links) {
      if (!seen.has(link.fromSegmentId)) {
        nodes.push({
          segmentId: link.fromSegmentId,
          type: link.fromType,
          order: link.sortOrder,
        })
        seen.add(link.fromSegmentId)
      }
      if (!seen.has(link.toSegmentId)) {
        nodes.push({
          segmentId: link.toSegmentId,
          type: link.toType,
          order: link.sortOrder,
        })
        seen.add(link.toSegmentId)
      }
    }

    const edges = links.map(l => ({
      from: l.fromSegmentId,
      to: l.toSegmentId,
      linkType: l.linkType,
    }))

    // adjacency 键改为 segmentId
    const cleanedAdj: Record<string, string[]> = {}
    for (const [key, val] of Object.entries(adjacency)) {
      cleanedAdj[key] = val.next
    }

    return { nodes, edges, adjacency: cleanedAdj }
  }
}

export const temporalGraphEngine = new TemporalGraphEngine()
