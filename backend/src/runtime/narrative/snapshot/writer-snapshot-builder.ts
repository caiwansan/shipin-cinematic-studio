/**
 * WriterSnapshotBuilder — Writer 消费者的 Fact View
 * 
 * 将 Runtime 9 个子 Runtime + hdz 数据库组织成 Writer 所需的完整上下文。
 * 
 * ⚠️ 无循环依赖：Builder 直接通过 narrativeRepository 读 Runtime JSON 文件，
 *    不通过 narrativeRuntime 门面。
 * 
 * 替代目前 Writer Service 中的：
 *   - $CHARACTER_CONTEXT
 *   - $MEMORY_CONTEXT  
 *   - $CHAPTER_SUMMARIES
 *   - 场景合约注入
 * 
 * Writer 不再接触 Memory 这个词。
 * Writer 只消费 Fact View。
 */

import { narrativeRepository } from '../narrative-repository.js'
import { prisma } from '../../../utils/index.js'
import type {
  SnapshotBuilder, WriterSnapshot,
  WriterSnapshotCharacter, WriterSnapshotEvent, WriterSnapshotRelationship,
  WriterSnapshotKnowledge, WriterSnapshotForeshadow,
  WriterSnapshotInventoryItem, WriterSnapshotOrganization,
  WriterSnapshotTimelineEntry, WriterSnapshotConstraints, WriterSnapshotWritingContext,
  SnapshotContext,
} from './snapshot-types.js'

export class WriterSnapshotBuilder implements SnapshotBuilder<WriterSnapshot> {
  async build(projectId: string, context: SnapshotContext): Promise<WriterSnapshot> {
    const chapterNo = context.chapterNo || 1
    const focusChar = context.focusCharacter

    // ── 并行读取 Runtime 快照（从 JSON 文件，非 async） ──
    const characters = this.buildCharacters(projectId, focusChar)
    const events = this.buildEvents(projectId, chapterNo)
    const timeline = this.buildTimeline(projectId, chapterNo)
    const relationships = this.buildRelationships(projectId, focusChar)
    const knowledge = this.buildKnowledge(projectId, focusChar)
    const foreshadows = this.buildForeshadows(projectId, chapterNo)
    const inventory = this.buildInventory(projectId)
    const organizations = this.buildOrganizations(projectId)
    const world = this.buildWorld(projectId)

    // ── 从数据库读取非 Runtime 数据 ──
    const [project, chapter, allChapters, styleDna] = await Promise.all([
      prisma.hdzProject.findUnique({
        where: { id: projectId },
        select: {
          title: true, genre: true, chapterWordTarget: true,
          masterStyle: true, styleDesc: true,
          locks: true,
        },
      }),
      prisma.hdzChapter.findUnique({
        where: { projectId_chapterNo: { projectId, chapterNo } },
        select: { title: true, outline: true },
      }),
      prisma.hdzChapter.findMany({
        where: { projectId },
        orderBy: { chapterNo: 'asc' },
        select: { chapterNo: true, title: true, summary: true, outline: true },
      }),
      prisma.hdzStyleDna.findFirst({
        where: { projectId },
      }),
    ])

    // ── 构建约束 ──
    const locks = (project?.locks as any) || {}
    const constraints: WriterSnapshotConstraints = {
      outlineLocked: locks.outlineLocked !== false,
      logicLocked: locks.logicLocked !== false,
      styleLocked: locks.styleLocked !== false,
      styleReference: this.buildStyleReference(project, styleDna),
    }

    // ── 构建写作上下文 ──
    const prevChapters = allChapters.filter(c => c.chapterNo < chapterNo).slice(-5)
    const writingContext: WriterSnapshotWritingContext = {
      currentChapterNo: chapterNo,
      chapterTitle: chapter?.title || '',
      outline: chapter?.outline || '',
      recentChapterSummaries: prevChapters.map(c => ({
        chapterNo: c.chapterNo,
        title: c.title || '',
        summary: c.summary || '',
      })),
      fullOutlineIndex: allChapters.map(c => `第${c.chapterNo}章「${c.title}」`).join(', '),
      wordTarget: project?.chapterWordTarget || 3000,
    }

    // ── 世界观状态摘要 ──
    // 已由 buildWorld() 填充到 world

    return {
      characters,
      events,
      timeline,
      relationships,
      knowledge,
      foreshadows,
      inventory,
      organizations,
      world,
      constraints,
      writingContext,
    }
  }

  // ── 子构建器 ──

  private buildCharacters(projectId: string, focusChar?: string): WriterSnapshotCharacter[] {
    const snapshot = narrativeRepository.readJson<any[]>(projectId, 'character', 'snapshot.json') || []
    return snapshot.slice(0, 30).map((c: any) => ({
      name: c.characterName || '未知',
      role: c.role || 'unknown',
      lifecycle: c.lifecycle || 'alive',
      statusFlags: c.flags || [],
      currentGoal: c.currentGoal || '',
      knownSecrets: [],
      unknownSecrets: [],
    }))
  }

  private buildEvents(projectId: string, chapterNo: number): WriterSnapshotEvent[] {
    const snapshot = narrativeRepository.readJson<any[]>(projectId, 'event', 'snapshot.json') || []
    const windowStart = Math.max(1, chapterNo - 10)
    // Ch.1 时没有前序章节，允许包含当前章事件
    const includeCurrent = chapterNo <= 1
    return snapshot
      .filter((e: any) => {
        if (includeCurrent) return e.chapterNo <= chapterNo
        return e.chapterNo >= windowStart && e.chapterNo < chapterNo
      })
      .slice(-20)
      .map((e: any) => ({
        id: e.id,
        title: e.title || '未命名事件',
        description: e.description || '',
        category: e.category || 'other',
        chapterNo: e.chapterNo || 1,
        participants: (e.participants || []).map((p: any) => ({
          characterName: p.characterName || '未知',
          role: p.role || 'witness',
        })),
        consequences: (e.consequences || []).map((c: any) => c.description || JSON.stringify(c)),
      }))
  }

  private buildTimeline(projectId: string, chapterNo: number): WriterSnapshotTimelineEntry[] {
    const snapshot = narrativeRepository.readJson<any[]>(projectId, 'timeline', 'entries.json') || []
    return snapshot
      .filter((t: any) => t.chapterNo <= chapterNo)
      .slice(-20)
      .map((t: any) => ({
        chapterNo: t.chapterNo || 0,
        summary: t.summary || '',
        linkedEventIds: t.eventIds || [],
        storyTime: t.storyTime?.timeDescription || undefined,
      }))
  }

  private buildRelationships(projectId: string, focusChar?: string): WriterSnapshotRelationship[] {
    const snapshot = narrativeRepository.readJson<any[]>(projectId, 'relationship', 'snapshot.json') || []
    const rels = (snapshot as any[] || [])
    const filtered = focusChar
      ? rels.filter((r: any) => r.characterAName === focusChar || r.characterBName === focusChar)
      : rels
    return filtered.slice(0, 50).map((r: any) => ({
      characterA: r.characterAName || '未知',
      characterB: r.characterBName || '未知',
      bondType: r.currentStage?.type || 'unknown',
      status: r.currentStage?.status || 'active',
      trustLevel: r.trustLevel || 0,
      recentStages: (r.stages || []).slice(-3).map((s: any) => ({
        type: s.type || 'unknown',
        turningPoint: s.turningPoint || '',
        chapterNo: s.turningPointChapter || 1,
      })),
    }))
  }

  private buildKnowledge(projectId: string, focusChar?: string): WriterSnapshotKnowledge[] {
    const snapshot = narrativeRepository.readJson<any[]>(projectId, 'knowledge', 'snapshot.json') || []
    return snapshot.slice(0, 20).map((k: any) => ({
      id: k.id || '',
      description: k.description || '',
      knownBy: k.knownBy || [],
      revealedChapterNo: k.revealedChapterNo || 1,
    }))
  }

  private buildForeshadows(projectId: string, chapterNo: number): WriterSnapshotForeshadow[] {
    const snapshot = narrativeRepository.readJson<any[]>(projectId, 'foreshadow', 'snapshot.json') || []
    return snapshot
      .filter((f: any) => f.status === 'planted' || f.status === 'active')
      .slice(0, 15)
      .map((f: any) => ({
        id: f.id || '',
        description: f.description || '',
        status: f.status || 'planted',
        plantedChapterNo: f.plantedChapterNo || 1,
        expectedPayoffWindow: f.expectedPayoffWindow || undefined,
      }))
  }

  private buildInventory(projectId: string): WriterSnapshotInventoryItem[] {
    const snapshot = narrativeRepository.readJson<any[]>(projectId, 'inventory', 'snapshot.json') || []
    return snapshot.slice(0, 20).map((i: any) => ({
      itemName: i.itemName || '未知物品',
      itemType: i.itemType || 'other',
      ownerCharacterName: i.ownerCharacterName || '',
      description: i.description || '',
    }))
  }

  private buildOrganizations(projectId: string): WriterSnapshotOrganization[] {
    const snapshot = narrativeRepository.readJson<any[]>(projectId, 'organization', 'snapshot.json') || []
    return snapshot.slice(0, 10).map((o: any) => ({
      name: o.name || '未知组织',
      type: o.type || 'sect',
      description: o.description || '',
      leaderName: o.leaderHistory?.[0]?.characterName || '',
      status: o.currentStatus || 'active',
    }))
  }

  private buildWorld(projectId: string): string {
    try {
      const snapshot = narrativeRepository.readJson<any>(projectId, 'world', 'world-state.json')
      return snapshot?.worldState?.description || '尚未建立世界观'
    } catch {
      return '尚未建立世界观'
    }
  }

  private buildStyleReference(project: any, styleDna: any): string | undefined {
    if (project?.masterStyle) {
      const styles: Record<string, string> = {
        wangzengqi: '风格参照汪曾祺：用最浅最淡最短的白话写作，干净得像水洗过的玻璃。',
        laoshe: '风格参照老舍：句子像胡同里的风，流畅鲜活幽默。',
        zhangailing: '风格参照张爱玲：比喻奇峭又残酷，苍凉中见精细。',
        chenzhongshi: '风格参照陈忠实：文字厚重雄浑，没有花哨全是骨力。',
        jiapingwa: '风格参照贾平凹：文风质朴沉郁，大巧若拙。',
        moyan: '风格参照莫言：语言狂野奔放，魔幻现实主义。',
        yuhua: '风格参照余华：零度写作，用克制的笔墨写残酷。',
        liuzhenyun: '风格参照刘震云：语言幽默荒诞，善用对话推进叙事。',
        jinyucheng: '风格参照金宇澄《繁花》：句子极短段落极密，通篇白描。',
        liuliangcheng: '风格参照刘亮程：散文诗质感，粗糙中有细腻。',
      }
      return styles[project.masterStyle]
    }
    if (styleDna?.sourceText) {
      return `参考写作风格（AI 应模仿此文风）：${styleDna.sourceText.slice(0, 1500)}`
    }
    return undefined
  }

  private summarizeWorld(worldSnapshot: any): string {
    if (!worldSnapshot?.worldState) return '尚未建立世界观'
    const w = worldSnapshot.worldState
    const parts: string[] = []
    if (w.description) parts.push(w.description)
    if (w.factions?.length > 0) {
      parts.push(`势力格局: ${w.factions.map((f: any) => `${f.name}(${f.status || 'active'})`).join(', ')}`)
    }
    return parts.join('\n') || '世界观已建立'
  }
}
