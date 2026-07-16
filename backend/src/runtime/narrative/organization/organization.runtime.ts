/**
 * Organization Runtime — 组织/势力演变
 * 
 * Phase 2 新增。
 * 和 World Runtime 的 Faction 不同——Organization 有完整的生命周期演变。
 * World Runtime 的 Faction 是静态的快照，Organization 是动态的。
 * 未来可以合并到 World Runtime，但现在保持独立。
 * 
 * Queryable:
 * - 青云宗经历过几次变革？
 * - 魔族分裂了还是没有？
 * - 长老会现在谁说了算？
 */

import { randomUUID as uuid } from 'crypto'
import type { OrganizationFact, OrganizationType, OrganizationStatus, OrganizationStage, TraceInfo } from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'

const RUNTIME_NAME = 'organization'

export class OrganizationRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json')
    if (existing) return
    narrativeRepository.writeJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json', [])
    console.log(`[OrganizationRuntime] initialized for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<OrganizationFact[]> {
    return narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json') || []
  }

  // ─── 管理 ───

  /** 创建组织 */
  create(projectId: string, org: Omit<OrganizationFact, 'id' | 'projectId' | 'active' | 'currentStatus' | 'stages'> & { initialStatus?: OrganizationStatus }): OrganizationFact {
    const all = narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json') || []
    const initialStatus = org.initialStatus || 'founding'
    const stage: OrganizationStage = {
      status: initialStatus,
      chapterNo: org.trace.chapterNo,
      description: `${org.name}成立`,
      trace: org.trace,
      from: new Date().toISOString(),
    }
    const fact: OrganizationFact = {
      ...org,
      id: uuid(),
      projectId,
      stages: [stage],
      currentStatus: initialStatus,
      active: true,
    }
    all.push(fact)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'organizations.json', all)
    return fact
  }

  /** 组织状态变化 */
  evolve(projectId: string, orgId: string, stage: Omit<OrganizationStage, 'from'>): void {
    const all = narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json') || []
    const idx = all.findIndex(o => o.id === orgId)
    if (idx === -1) return
    const s: OrganizationStage = { ...stage, from: new Date().toISOString() }
    // 标记上一阶段结束
    const last = all[idx].stages[all[idx].stages.length - 1]
    if (last && !last.to) last.to = new Date().toISOString()
    all[idx].stages.push(s)
    all[idx].currentStatus = stage.status
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'organizations.json', all)
  }

  /** 更换首领 */
  changeLeader(projectId: string, orgId: string, newLeaderId: string, newLeaderName: string, title: string, chapterNo: number): void {
    const all = narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json') || []
    const idx = all.findIndex(o => o.id === orgId)
    if (idx === -1) return
    // 标记上一任结束
    const lastLeader = all[idx].leaderHistory[all[idx].leaderHistory.length - 1]
    if (lastLeader && !lastLeader.toChapter) lastLeader.toChapter = chapterNo
    all[idx].leaderHistory.push({
      characterId: newLeaderId,
      characterName: newLeaderName,
      title,
      fromChapter: chapterNo,
    })
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'organizations.json', all)
  }

  /** 添加成员 */
  addMember(projectId: string, orgId: string, characterId: string): void {
    const all = narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json') || []
    const idx = all.findIndex(o => o.id === orgId)
    if (idx === -1 || all[idx].memberIds.includes(characterId)) return
    all[idx].memberIds.push(characterId)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'organizations.json', all)
  }

  /** 移除成员 */
  removeMember(projectId: string, orgId: string, characterId: string): void {
    const all = narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json') || []
    const idx = all.findIndex(o => o.id === orgId)
    if (idx === -1) return
    all[idx].memberIds = all[idx].memberIds.filter(m => m !== characterId)
    all[idx].leaderHistory = all[idx].leaderHistory.filter(l => l.characterId !== characterId)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'organizations.json', all)
  }

  // ─── 查询 ───

  getByName(projectId: string, name: string): OrganizationFact | null {
    const all = narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json') || []
    return all.find(o => o.name === name && o.active) || null
  }

  getByMember(projectId: string, characterId: string): OrganizationFact[] {
    const all = narrativeRepository.readJson<OrganizationFact[]>(projectId, RUNTIME_NAME, 'organizations.json') || []
    return all.filter(o => o.memberIds.includes(characterId) && o.active)
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'organizations.json')
  }
}
