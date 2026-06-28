/**
 * World Memory Service — 世界记忆图
 *
 * 存储/检索角色、世界观、事件的连续性信息。
 * Narrative 生成时可注入历史上下文保证一致性。
 */

import { prisma } from '../utils/index.js'

export interface WorldMemoryInput {
  projectId: string
  entityType: 'character' | 'world' | 'event' | 'relationship'
  entityId: string
  name?: string
  memory: Record<string, any>
  tags?: string[]
  episodeRef?: number
}

export interface NarrativeContext {
  characters: any[]
  worldState: any[]
  recentEvents: any[]
  previousEpisodes: string[]
}

class WorldMemoryService {
  /** 写入记忆（upsert） */
  async upsert(input: WorldMemoryInput): Promise<void> {
    const { projectId, entityType, entityId, name, memory, tags, episodeRef } = input
    await prisma.worldMemory.upsert({
      where: { projectId_entityType_entityId: { projectId, entityType, entityId } },
      create: { projectId, entityType, entityId, name, memory, tags: tags || [], episodeRef },
      update: { memory, tags: tags || [], episodeRef, name },
    })
  }

  /** 写入批量记忆（一次 narrative 后调用） */
  async ingestNarrativeOutput(projectId: string, narrative: any, blueprint: any, episodeRef?: number): Promise<void> {
    // 写入主题/世界观
    if (narrative.theme || narrative.storyWorld) {
      await this.upsert({
        projectId,
        entityType: 'world',
        entityId: 'theme',
        name: narrative.theme || '主世界观',
        memory: {
          theme: narrative.theme,
          storyWorld: narrative.storyWorld,
          coreConflict: narrative.coreConflict,
          tone: narrative.tone,
          genre: narrative.genre,
        },
        tags: ['world', narrative.genre || 'general'],
        episodeRef,
      })
    }

    // 写入角色
    const chars = narrative.characterNetwork || blueprint?.characters || []
    for (const c of chars) {
      const charId = c.id || c.name || `char_${Date.now()}`
      await this.upsert({
        projectId,
        entityType: 'character',
        entityId: charId,
        name: c.name || c.role,
        memory: c,
        tags: ['character', c.role || 'supporting'],
        episodeRef,
      })
    }

    // 写入关键事件/节拍
    const beats = narrative.narrativeBeats || []
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i]
      if (beat.beat || beat.description) {
        await this.upsert({
          projectId,
          entityType: 'event',
          entityId: `beat_${episodeRef || 0}_${i}`,
          name: beat.beat || `节拍${i + 1}`,
          memory: {
            description: beat.description || beat.beat,
            position: i,
            duration: beat.estimatedDuration,
            visualStyle: beat.visualStyle,
          },
          tags: ['narrative_beat'],
          episodeRef,
        })
      }
    }
  }

  /** 获取叙事上下文（供 narrative 注入使用） */
  async getNarrativeContext(projectId: string, episodeRef?: number): Promise<NarrativeContext> {
    const allRecords = await prisma.worldMemory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const characters = allRecords
      .filter(r => r.entityType === 'character')
      .map(r => ({ id: r.entityId, name: r.name, ...(r.memory as any) }))

    const worldState = allRecords
      .filter(r => r.entityType === 'world')
      .map(r => r.memory)

    const recentEvents = allRecords
      .filter(r => r.entityType === 'event')
      .slice(-10)
      .map(r => ({ id: r.entityId, name: r.name, ...(r.memory as any) }))

    const previousEpisodes = [...new Set(
      allRecords
        .filter(r => r.episodeRef != null && (episodeRef == null || r.episodeRef < episodeRef))
        .map(r => `第${r.episodeRef}集`)
    )]

    return { characters, worldState, recentEvents, previousEpisodes }
  }

  /** 清除项目记忆 */
  async clearProject(projectId: string): Promise<void> {
    await prisma.worldMemory.deleteMany({ where: { projectId } })
  }
}

export const worldMemory = new WorldMemoryService()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

