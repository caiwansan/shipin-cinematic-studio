/**
 * D1-1 Continuity Link Engine — 时续关系引擎
 *
 * 兼容现有 ContinuityLink schema：
 *   fromSegmentId → toSegmentId | linkType
 *   fromType / toType 表示连接类型（keyframe/scene/shot）
 *
 * 有向图：next_scene | same_character | same_environment | same_camera
 */

import { prisma } from '../utils/index.js'

export type ContinuityLinkType = 'next_scene' | 'same_character' | 'same_environment' | 'same_camera'
export type SegmentType = 'keyframe_tail' | 'keyframe_head' | 'scene_exit' | 'scene_enter' | 'shot_end' | 'shot_start'

export class ContinuityLinkEngine {
  /**
   * 创建连续性链接
   */
  async createLink(params: {
    projectId: string
    fromSegmentId: string
    toSegmentId: string
    linkType: ContinuityLinkType
    fromType?: SegmentType
    toType?: SegmentType
    inheritedContent?: any
  }) {
    const { projectId, fromSegmentId, toSegmentId, linkType, fromType, toType, inheritedContent } = params

    return prisma.continuityLink.create({
      data: {
        projectId,
        fromSegmentId,
        toSegmentId,
        linkType,
        fromType: fromType || 'shot_end',
        toType: toType || 'shot_start',
        inheritedContent: inheritedContent ? (inheritedContent as any) : undefined,
      },
    })
  }

  /**
   * 获取从某个 segment 出发的所有链接
   */
  async getOutboundLinks(fromSegmentId: string) {
    return prisma.continuityLink.findMany({
      where: { fromSegmentId },
    })
  }

  /**
   * 获取指向某个 segment 的所有链接
   */
  async getInboundLinks(toSegmentId: string) {
    return prisma.continuityLink.findMany({
      where: { toSegmentId },
    })
  }

  /**
   * 获取项目的完整连续性图
   */
  async getProjectGraph(projectId: string) {
    const links = await prisma.continuityLink.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    })

    const adjacency: Record<string, { next: string[]; linkType: string }> = {}
    for (const link of links) {
      if (!adjacency[link.fromSegmentId]) {
        adjacency[link.fromSegmentId] = { next: [], linkType: link.linkType }
      }
      adjacency[link.fromSegmentId].next.push(link.toSegmentId)
    }

    return { links, adjacency }
  }

  /**
   * 获取有序序列
   */
  async getOrderedSequence(projectId: string): Promise<string[]> {
    const links = await prisma.continuityLink.findMany({
      where: { projectId, linkType: 'next_scene' },
      orderBy: { sortOrder: 'asc' },
    })

    if (!links.length) return []

    const fromSet = new Set(links.map(l => l.fromSegmentId))
    const toSet = new Set(links.map(l => l.toSegmentId))

    // 找起点（没有入度的节点）
    const start = [...fromSet].find(id => !toSet.has(id))
    if (!start) return [links[0].fromSegmentId]

    const sequence: string[] = [start]
    let current = start
    const linkMap = new Map(links.map(l => [l.fromSegmentId, l.toSegmentId]))

    while (linkMap.has(current)) {
      current = linkMap.get(current)!
      sequence.push(current)
    }

    return sequence
  }
}

export const continuityLinkEngine = new ContinuityLinkEngine()
