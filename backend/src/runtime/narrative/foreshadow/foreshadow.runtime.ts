/**
 * Foreshadow Runtime — 伏笔系统
 * 
 * SSOT for: 所有已埋下的伏笔及其回收状态
 * 
 * Queryable:
 * - 第 37 章埋下的伏笔是否已经回收？
 * - 有哪些伏笔已经超期未回收？
 * - 当前有哪些活跃的伏笔？
 */

import type { ForeshadowFact, ForeshadowStatus, TraceInfo } from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'
import { randomUUID as uuid } from 'crypto'

const RUNTIME_NAME = 'foreshadow'

export class ForeshadowRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json')
    if (existing) return
    narrativeRepository.writeJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json', [])
    console.log(`[ForeshadowRuntime] initialized for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<ForeshadowFact[]> {
    return narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
  }

  // ─── 管理方法 ───

  /** 埋下伏笔 */
  plant(projectId: string, foreshadow: Omit<ForeshadowFact, 'id' | 'projectId' | 'status' | 'overdue'>): ForeshadowFact {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    const fact: ForeshadowFact = {
      ...foreshadow,
      id: uuid(),
      projectId,
      status: 'planted',
      overdue: false,
    }
    all.push(fact)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'foreshadows.json', all)
    return fact
  }

  /** 标记伏笔为活跃（已触发但尚未回收） */
  activate(projectId: string, foreshadowId: string, chapterNo: number): void {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    const idx = all.findIndex(f => f.id === foreshadowId)
    if (idx === -1) return
    all[idx].status = 'active'
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'foreshadows.json', all)
  }

  /** 回收伏笔 */
  payOff(projectId: string, foreshadowId: string, chapterNo: number): void {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    const idx = all.findIndex(f => f.id === foreshadowId)
    if (idx === -1) return
    all[idx].status = 'paid_off'
    all[idx].payoffChapterNo = chapterNo
    all[idx].overdue = false
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'foreshadows.json', all)
  }

  /** 放弃伏笔（剧情变更不再回收） */
  abandon(projectId: string, foreshadowId: string): void {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    const idx = all.findIndex(f => f.id === foreshadowId)
    if (idx === -1) return
    all[idx].status = 'abandoned'
    all[idx].overdue = false
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'foreshadows.json', all)
  }

  // ─── 查询方法 ───

  /** 获取所有活跃（未回收）的伏笔 */
  getActiveForeshadows(projectId: string): ForeshadowFact[] {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    return all.filter(f => f.status === 'planted' || f.status === 'active')
  }

  /** 获取所有已回收的伏笔 */
  getPaidOffForeshadows(projectId: string): ForeshadowFact[] {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    return all.filter(f => f.status === 'paid_off')
  }

  /** 获取指定角色相关的所有伏笔 */
  getForeshadowsByCharacter(projectId: string, characterId: string): ForeshadowFact[] {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    return all.filter(f => f.relatedCharacterIds.includes(characterId))
  }

  /** 获取指定章节埋下的伏笔 */
  getForeshadowsPlantedInChapter(projectId: string, chapterNo: number): ForeshadowFact[] {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    return all.filter(f => f.plantedChapterNo === chapterNo)
  }

  /** 检测并返回所有超期未回收的伏笔 */
  getOverdueForeshadows(projectId: string, currentChapterNo: number): ForeshadowFact[] {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    return all.filter(f => {
      if (f.status !== 'planted' && f.status !== 'active') return false
      if (!f.expectedPayoffWindow) return false
      return currentChapterNo > f.expectedPayoffWindow.toChapter
    }).map(f => ({ ...f, overdue: true }))
  }

  /** 获取最近的超期伏笔（MRI 用的来源数据） */
  scanOverdue(projectId: string, currentChapterNo: number): Array<{ id: string; description: string; plantedChapter: number; deadline: number }> {
    const all = narrativeRepository.readJson<ForeshadowFact[]>(projectId, RUNTIME_NAME, 'foreshadows.json') || []
    return all
      .filter(f => {
        if (f.status !== 'planted' && f.status !== 'active') return false
        if (!f.expectedPayoffWindow) return false
        return currentChapterNo > f.expectedPayoffWindow.toChapter
      })
      .map(f => ({
        id: f.id,
        description: f.description,
        plantedChapter: f.plantedChapterNo,
        deadline: f.expectedPayoffWindow!.toChapter,
      }))
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'foreshadows.json')
  }
}
