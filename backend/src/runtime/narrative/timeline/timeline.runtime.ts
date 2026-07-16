/**
 * Timeline Runtime — 统一时间轴
 * 
 * SSOT for: 故事时间线、章节排序、时间锚点
 * 
 * Queryable:
 * - 第 37 章发生在什么时间？
 * - 事件 A 和事件 B 哪个先发生？
 * - 第 50-60 章的 POV 是谁？
 */

import type { TimelineEntry, StoryTime, TraceInfo } from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'

const RUNTIME_NAME = 'timeline'

export class TimelineRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<TimelineEntry[]>(projectId, RUNTIME_NAME, 'timeline.json')
    if (existing) return

    // 从已有章节表初始化
    const chapters = await narrativeRepository.getChapters(projectId)
    const entries: TimelineEntry[] = chapters.map((ch: any) => ({
      id: `tl-${projectId}-${ch.chapterNo}`,
      projectId,
      chapterNo: ch.chapterNo,
      chapterTitle: ch.title || '',
      storyTime: {
        chapterNo: ch.chapterNo,
        sortOrder: ch.chapterNo,
      },
      eventIds: [],
      activeCharacterIds: [],
      povCharacterId: undefined,
      summary: ch.summary || '',
    }))

    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'timeline.json', entries)
    console.log(`[TimelineRuntime] initialized ${entries.length} entries for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<TimelineEntry[]> {
    return narrativeRepository.readJson<TimelineEntry[]>(projectId, RUNTIME_NAME, 'timeline.json') || []
  }

  getEntry(projectId: string, chapterNo: number): TimelineEntry | null {
    const all = narrativeRepository.readJson<TimelineEntry[]>(projectId, RUNTIME_NAME, 'timeline.json') || []
    return all.find(e => e.chapterNo === chapterNo) || null
  }

  /** 获取时间范围内的条目 */
  getRange(projectId: string, fromChapter: number, toChapter: number): TimelineEntry[] {
    const all = narrativeRepository.readJson<TimelineEntry[]>(projectId, RUNTIME_NAME, 'timeline.json') || []
    return all.filter(e => e.chapterNo >= fromChapter && e.chapterNo <= toChapter)
  }

  /** 添加新章节到时间轴 */
  addEntry(projectId: string, entry: Omit<TimelineEntry, 'id' | 'projectId'>): TimelineEntry {
    const all = narrativeRepository.readJson<TimelineEntry[]>(projectId, RUNTIME_NAME, 'timeline.json') || []
    const newEntry: TimelineEntry = {
      ...entry,
      id: `tl-${projectId}-${entry.chapterNo}`,
      projectId,
    }
    all.push(newEntry)
    all.sort((a, b) => a.chapterNo - b.chapterNo)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'timeline.json', all)
    return newEntry
  }

  /** 关联事件到时间轴条目 */
  linkEvent(projectId: string, chapterNo: number, eventId: string): void {
    const all = narrativeRepository.readJson<TimelineEntry[]>(projectId, RUNTIME_NAME, 'timeline.json') || []
    const idx = all.findIndex(e => e.chapterNo === chapterNo)
    if (idx === -1) return
    if (!all[idx].eventIds.includes(eventId)) {
      all[idx].eventIds.push(eventId)
      narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'timeline.json', all)
    }
  }

  /** 更新章节摘要 */
  updateSummary(projectId: string, chapterNo: number, summary: string): void {
    const all = narrativeRepository.readJson<TimelineEntry[]>(projectId, RUNTIME_NAME, 'timeline.json') || []
    const idx = all.findIndex(e => e.chapterNo === chapterNo)
    if (idx === -1) return
    all[idx].summary = summary
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'timeline.json', all)
  }

  /** 获取故事当前进度 */
  getProgress(projectId: string): { totalChapters: number; lastChapterNo: number; lastSummary?: string } {
    const all = narrativeRepository.readJson<TimelineEntry[]>(projectId, RUNTIME_NAME, 'timeline.json') || []
    const last = all[all.length - 1]
    return {
      totalChapters: all.length,
      lastChapterNo: last?.chapterNo || 0,
      lastSummary: last?.summary,
    }
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'timeline.json')
  }
}
