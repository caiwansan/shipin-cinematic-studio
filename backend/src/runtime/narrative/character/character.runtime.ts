/**
 * Character Runtime — 角色状态、生命周期、位置、Flags
 * 
 * SSOT for: 角色的当前状态、位置、状态变更历史
 * 
 * Queryable:
 * - 林辰当前在哪？
 * - 苏婉还活着吗？
 * - 陆归尘有什么异常状态？
 */

import type {
  CharacterFact, CharacterLifecycle,
  CharacterStatusFlag, CharacterLocation,
  CharacterRelationshipLink, TraceInfo,
} from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'
import { randomUUID as uuid } from 'crypto'

const RUNTIME_NAME = 'character'

export class CharacterRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<CharacterFact[]>(projectId, RUNTIME_NAME, 'characters.json')
    if (existing) return // 已初始化

    // 从现有 HdzCharacter 表构建初始状态
    const prismaChars = await narrativeRepository.getCharacters(projectId)
    const facts: CharacterFact[] = prismaChars.map((c: any) => ({
      id: c.id,
      projectId,
      characterId: c.id,
      characterName: c.name,
      lifecycle: 'alive' as CharacterLifecycle,
      lifecycleTrace: {
        chapterNo: 0,
        provenance: 'planner_outline',
      },
      currentLocation: null,
      statusFlags: [],
      relationships: (c.relations || []).map((r: any) => ({
        targetCharacterId: '',  // 需要查 name → id
        targetName: r.target || '',
        relationshipType: r.type || 'unknown',
        state: 'neutral',
        trace: { chapterNo: 0, provenance: 'planner_outline' },
      })),
      abilityChanges: [],
      isPov: false,
      currentArcStage: 'initiation',
      version: 1,
      updatedAt: new Date().toISOString(),
    }))

    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'characters.json', facts)
    console.log(`[CharacterRuntime] initialized ${facts.length} characters for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<CharacterFact[]> {
    return narrativeRepository.readJson<CharacterFact[]>(projectId, RUNTIME_NAME, 'characters.json') || []
  }

  getCharacter(projectId: string, characterId: string): CharacterFact | null {
    const all = narrativeRepository.readJson<CharacterFact[]>(projectId, RUNTIME_NAME, 'characters.json') || []
    return all.find(c => c.characterId === characterId) || null
  }

  getCharacterByName(projectId: string, name: string): CharacterFact | null {
    const all = narrativeRepository.readJson<CharacterFact[]>(projectId, RUNTIME_NAME, 'characters.json') || []
    return all.find(c => c.characterName === name) || null
  }

  // ─── 状态更新方法 ───

  updateLifecycle(projectId: string, characterId: string, lifecycle: CharacterLifecycle, trace: TraceInfo): void {
    const all = narrativeRepository.readJson<CharacterFact[]>(projectId, RUNTIME_NAME, 'characters.json') || []
    const idx = all.findIndex(c => c.characterId === characterId)
    if (idx === -1) return
    all[idx] = {
      ...all[idx],
      lifecycle,
      lifecycleTrace: trace,
      version: all[idx].version + 1,
      updatedAt: new Date().toISOString(),
    }
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'characters.json', all)
  }

  updateLocation(projectId: string, characterId: string, location: CharacterLocation, trace: TraceInfo): void {
    const all = narrativeRepository.readJson<CharacterFact[]>(projectId, RUNTIME_NAME, 'characters.json') || []
    const idx = all.findIndex(c => c.characterId === characterId)
    if (idx === -1) return
    all[idx] = {
      ...all[idx],
      currentLocation: location,
      version: all[idx].version + 1,
      updatedAt: new Date().toISOString(),
    }
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'characters.json', all)
  }

  addStatusFlag(projectId: string, characterId: string, flag: CharacterStatusFlag): void {
    const all = narrativeRepository.readJson<CharacterFact[]>(projectId, RUNTIME_NAME, 'characters.json') || []
    const idx = all.findIndex(c => c.characterId === characterId)
    if (idx === -1) return
    all[idx] = {
      ...all[idx],
      statusFlags: [...all[idx].statusFlags.filter(f => f.active), flag],
      version: all[idx].version + 1,
      updatedAt: new Date().toISOString(),
    }
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'characters.json', all)
  }

  expireStatusFlag(projectId: string, characterId: string, flagName: string, expiredAtChapter: number): void {
    const all = narrativeRepository.readJson<CharacterFact[]>(projectId, RUNTIME_NAME, 'characters.json') || []
    const idx = all.findIndex(c => c.characterId === characterId)
    if (idx === -1) return
    all[idx] = {
      ...all[idx],
      statusFlags: all[idx].statusFlags.map(f =>
        f.flag === flagName && f.active ? { ...f, active: false, expiredAt: expiredAtChapter } : f
      ),
      version: all[idx].version + 1,
      updatedAt: new Date().toISOString(),
    }
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'characters.json', all)
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'characters.json')
  }

  // ─── 查询方法 ───
  
  /** 查询角色当前在什么地方 */
  whereIs(projectId: string, characterName: string): string | null {
    const c = this.getCharacterByName(projectId, characterName)
    return c?.currentLocation?.locationName || null
  }

  /** 查询角色是否存活 */
  isAlive(projectId: string, characterName: string): boolean {
    const c = this.getCharacterByName(projectId, characterName)
    return c?.lifecycle === 'alive'
  }

  /** 查询角色的所有活跃状态 */
  getActiveFlags(projectId: string, characterName: string): CharacterStatusFlag[] {
    const c = this.getCharacterByName(projectId, characterName)
    return c?.statusFlags.filter(f => f.active) || []
  }
}
