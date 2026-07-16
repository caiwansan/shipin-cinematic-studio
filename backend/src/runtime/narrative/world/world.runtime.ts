/**
 * World Runtime — 世界观状态、势力格局、地理位置
 * 
 * SSOT for: 世界层面的全局状态
 * 
 * Queryable:
 * - 当前世界处于什么状态？
 * - 天剑宗目前被谁控制？
 * - 血魂殿还存在吗？
 * - 天地间有什么异象？
 */

import type { FactionFact, LocationFact, WorldStateFact, TraceInfo } from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'
import { randomUUID as uuid } from 'crypto'

const RUNTIME_NAME = 'world'

export class WorldRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<{factions: FactionFact[]; locations: LocationFact[]; worldState: WorldStateFact | null}>(projectId, RUNTIME_NAME, 'world.json')
    if (existing) return

    // 从现有数据初始化
    const prismaChars = await narrativeRepository.getCharacters(projectId)
    const factions: FactionFact[] = []
    const factionNames = new Set<string>()

    // 从角色的 faction 属性提取势力信息
    for (const c of prismaChars as any[]) {
      const props = c.properties || {}
      if (props.faction && !factionNames.has(props.faction)) {
        factionNames.add(props.faction)
        factions.push({
          id: uuid(),
          projectId,
          name: props.faction,
          type: 'sect',
          description: '',
          leaderIds: [],
          memberIds: [c.id],
          currentState: 'stable',
          controlledLocations: [],
          enemyFactionIds: [],
          allyFactionIds: [],
          trace: { chapterNo: 0, provenance: 'planner_outline' },
        })
      }
    }

    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'world.json', {
      factions,
      locations: [],
      worldState: null,
    })
    console.log(`[WorldRuntime] initialized for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<{factions: FactionFact[]; locations: LocationFact[]; worldState: WorldStateFact | null}> {
    return narrativeRepository.readJson(projectId, RUNTIME_NAME, 'world.json') || { factions: [], locations: [], worldState: null }
  }

  // ─── 势力管理 ───

  addFaction(projectId: string, faction: Omit<FactionFact, 'id' | 'projectId'>): FactionFact {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { factions: [], locations: [], worldState: null }
    const fact: FactionFact = { ...faction, id: uuid(), projectId }
    data.factions.push(fact)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'world.json', data)
    return fact
  }

  getFaction(projectId: string, factionId: string): FactionFact | null {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { factions: [] }
    return data.factions.find((f: FactionFact) => f.id === factionId) || null
  }

  getFactionByName(projectId: string, name: string): FactionFact | null {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { factions: [] }
    return data.factions.find((f: FactionFact) => f.name === name) || null
  }

  updateFactionState(projectId: string, factionId: string, state: FactionFact['currentState'], trace: TraceInfo): void {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { factions: [], locations: [], worldState: null }
    const idx = data.factions.findIndex((f: FactionFact) => f.id === factionId)
    if (idx === -1) return
    data.factions[idx].currentState = state
    data.factions[idx].trace = trace
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'world.json', data)
  }

  // ─── 地点管理 ───

  addLocation(projectId: string, location: Omit<LocationFact, 'id' | 'projectId'>): LocationFact {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { factions: [], locations: [], worldState: null }
    const fact: LocationFact = { ...location, id: uuid(), projectId }
    data.locations.push(fact)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'world.json', data)
    return fact
  }

  getLocation(projectId: string, locationId: string): LocationFact | null {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { locations: [] }
    return data.locations.find((l: LocationFact) => l.id === locationId) || null
  }

  getLocationByName(projectId: string, name: string): LocationFact | null {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { locations: [] }
    return data.locations.find((l: LocationFact) => l.name === name) || null
  }

  updateLocationState(projectId: string, locationId: string, state: LocationFact['currentState'], trace: TraceInfo): void {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { factions: [], locations: [], worldState: null }
    const idx = data.locations.findIndex((l: LocationFact) => l.id === locationId)
    if (idx === -1) return
    data.locations[idx].currentState = state
    data.locations[idx].trace = trace
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'world.json', data)
  }

  // ─── 世界状态管理 ───

  setWorldState(projectId: string, state: Omit<WorldStateFact, 'id' | 'projectId'>): WorldStateFact {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { factions: [], locations: [], worldState: null }
    const fact: WorldStateFact = { ...state, id: uuid(), projectId }
    data.worldState = fact
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'world.json', data)
    return fact
  }

  getWorldState(projectId: string): WorldStateFact | null {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || {}
    return data.worldState || null
  }

  addWorldChange(projectId: string, change: { chapterNo: number; change: string; impact: 'minor' | 'moderate' | 'major' | 'cataclysmic' }): void {
    const data = narrativeRepository.readJson<any>(projectId, RUNTIME_NAME, 'world.json') || { factions: [], locations: [], worldState: null }
    if (!data.worldState) {
      data.worldState = {
        id: uuid(),
        projectId,
        description: '',
        majorChanges: [],
        heavenlyAnomalies: [],
        powerCeiling: '',
        trace: { chapterNo: change.chapterNo, provenance: 'event_extraction' },
      }
    }
    data.worldState.majorChanges.push(change)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'world.json', data)
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'world.json')
  }
}
