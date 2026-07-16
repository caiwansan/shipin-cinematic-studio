/**
 * Event Runtime — 事件数据库（Event Store）
 * 
 * SSOT for: 故事中发生的所有重要事件
 * 
 * Queryable:
 * - 皇帝为什么中毒？是谁下的毒？
 * - 第 37 章埋下的伏笔是否已回收？
 * - 血魂殿被攻破后发生了什么？
 */

import type { EventFact, EventCategory, StoryTime, TraceInfo } from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'
import { randomUUID as uuid } from 'crypto'

const RUNTIME_NAME = 'event'

export class EventRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json')
    if (existing) return
    // 初始为空，由 Story Librarian（Phase 2）或事件提取器填充
    narrativeRepository.writeJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json', [])
    console.log(`[EventRuntime] initialized for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<EventFact[]> {
    return narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json') || []
  }

  addEvent(projectId: string, event: Omit<EventFact, 'id' | 'projectId' | 'active'>): EventFact {
    const all = narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json') || []
    const fact: EventFact = {
      ...event,
      id: uuid(),
      projectId,
      active: true,
    }
    all.push(fact)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'events.json', all)
    return fact
  }

  getEvent(projectId: string, eventId: string): EventFact | null {
    const all = narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json') || []
    return all.find(e => e.id === eventId) || null
  }

  getEventsByChapter(projectId: string, chapterNo: number): EventFact[] {
    const all = narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json') || []
    return all.filter(e => e.chapterNo === chapterNo)
  }

  getEventsByCharacter(projectId: string, characterId: string): EventFact[] {
    const all = narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json') || []
    return all.filter(e => e.participants.some(p => p.characterId === characterId))
  }

  getEventsByLocation(projectId: string, locationName: string): EventFact[] {
    const all = narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json') || []
    return all.filter(e => e.locationName === locationName)
  }

  getEventsByCategory(projectId: string, category: EventCategory): EventFact[] {
    const all = narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json') || []
    return all.filter(e => e.category === category)
  }

  /** 查询事件链：从某个事件开始的所有后续和相关事件 */
  getEventChain(projectId: string, sourceEventId: string): EventFact[] {
    const all = narrativeRepository.readJson<EventFact[]>(projectId, RUNTIME_NAME, 'events.json') || []
    const chain: EventFact[] = []
    const visited = new Set<string>()
    const queue = [sourceEventId]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const ev = all.find(e => e.id === id)
      if (ev) {
        chain.push(ev)
        for (const c of ev.consequences) {
          if (c.factId && !visited.has(c.factId)) queue.push(c.factId)
        }
      }
    }
    return chain
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'events.json')
  }
}
