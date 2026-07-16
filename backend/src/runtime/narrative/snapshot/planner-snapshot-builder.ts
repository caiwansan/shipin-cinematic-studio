/**
 * PlannerSnapshotBuilder — Planner 消费者的 Fact View
 * 
 * ⚠️ 无循环依赖：Builder 直接通过 narrativeRepository 读 Runtime JSON 文件，
 *    不通过 narrativeRuntime 门面。
 * 
 * 替代目前 Planner Service 中的：
 *   - $CHAIN_CONTEXT（旧章节摘要）
 *   - $EXISTING_SUMMARIES（hdzChapter.summary）
 *   - $CHARACTER_BLOCK（精简角色列表）
 * 
 * Planner 不再读 summary 表。
 * Planner 只消费 Runtime Facts + Timeline。
 */

import { narrativeRepository } from '../narrative-repository.js'
import { prisma } from '../../../utils/index.js'
import type { SnapshotBuilder, PlannerSnapshot, PlannerSnapshotChapterHistory, PlannerSnapshotCharacterBlock, SnapshotContext } from './snapshot-types.js'

export class PlannerSnapshotBuilder implements SnapshotBuilder<PlannerSnapshot> {
  async build(projectId: string, context: SnapshotContext): Promise<PlannerSnapshot> {
    // ── Runtime 数据（从 JSON 文件读，不通过 narrativeRuntime 门面） ──
    const characterSnapshot = narrativeRepository.readJson<any[]>(projectId, 'character', 'snapshot.json') || []
    const foreshadowSnapshot = narrativeRepository.readJson<any[]>(projectId, 'foreshadow', 'snapshot.json') || []
    const eventSnapshot = narrativeRepository.readJson<any[]>(projectId, 'event', 'snapshot.json') || []
    const timelineSnapshot = narrativeRepository.readJson<any[]>(projectId, 'timeline', 'entries.json') || []

    const allChapters = await prisma.hdzChapter.findMany({
      where: { projectId },
      orderBy: { chapterNo: 'asc' },
      select: { chapterNo: true, title: true, summary: true, outline: true, wordCount: true },
    })

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { wordTarget: true, chapterWordTarget: true, locks: true },
    })

    // ── Chapter History（从 Timeline + Event Runtime 建，不用 summary） ──
    const chapterHistory: PlannerSnapshotChapterHistory[] = allChapters.map(ch => {
      const chapterEvents = eventSnapshot.filter((e: any) => e.chapterNo === ch.chapterNo)
      const chapterTimeline = timelineSnapshot.find((t: any) => t.chapterNo === ch.chapterNo)
      const charNames = new Set<string>()
      for (const ev of chapterEvents) {
        for (const p of (ev.participants || [])) {
          if (p.characterName) charNames.add(p.characterName)
        }
      }
      return {
        chapterNo: ch.chapterNo,
        title: ch.title || '',
        // ★ 不再依赖 hdzChapter.summary
        //   用 Timeline 的 summary 代替（由 Story Librarian 维护）
        summary: chapterTimeline?.summary || ch.summary?.slice(0, 300) || '',
        outline: ch.outline || '',
        keyEventIds: chapterEvents.map((e: any) => e.id).filter(Boolean),
        charactersIntroduced: Array.from(charNames),
      }
    })

    // ── Character Block（从 Character Runtime 读，不再从 hdzCharacter 拼） ──
    const characters: PlannerSnapshotCharacterBlock[] = characterSnapshot.map((c: any) => ({
      name: c.characterName || '未知',
      role: c.role || 'unknown',
      personality: `${c.role || ''}`,
      lifecycle: c.lifecycle || 'alive',
      pendingArcs: [],
    }))

    // ── 未消耗的伏笔 ──
    const unconsumedForeshadows = foreshadowSnapshot
      .filter((f: any) => f.status === 'planted' || f.status === 'active')
      .slice(0, 20)
      .map((f: any) => ({
        id: f.id || '',
        description: f.description || '',
        status: f.status || 'planted',
        plantedChapterNo: f.plantedChapterNo || 1,
        expectedPayoffWindow: f.expectedPayoffWindow || undefined,
      }))

    const locks = (project?.locks as any) || {}
    const wordTarget = project?.wordTarget || 50000
    const existingWords = allChapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0)

    return {
      chapterHistory,
      characters,
      unconsumedForeshadows,
      worldStatus: '',  // Planner 目前不深度读世界状态，可后续扩展
      constraints: {
        outlineLocked: locks.outlineLocked !== false,
        logicLocked: locks.logicLocked !== false,
        styleLocked: locks.styleLocked !== false,
      },
      wordTarget,
      existingWordCount: existingWords,
    }
  }
}
