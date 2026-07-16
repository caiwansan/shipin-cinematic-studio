/**
 * Relationship Runtime — 动态关系图谱
 * 
 * SSOT for: 角色之间的动态关系演变
 * 
 * 关系不是静态标签，而是有生命周期的：恋爱→订婚→结婚→冷战→离婚→复合
 * 每一次变化都记录在 Timeline 上。
 * 
 * Queryable:
 * - 苏婉和林辰目前是什么关系？经历了哪些变化？
 * - 沈清漪和陆归尘之间还有芥蒂吗？
 * - 谁是陆归尘最信任的人？
 */

import type { RelationshipFact, BondType, BondStatus, RelationshipStage, TraceInfo } from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'
import { randomUUID as uuid } from 'crypto'

const RUNTIME_NAME = 'relationship'

export class RelationshipRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<RelationshipFact[]>(projectId, RUNTIME_NAME, 'relationships.json')
    if (existing) return

    // 从现有 HdzCharacter 表的 relations 字段初始化
    const prismaChars = await narrativeRepository.getCharacters(projectId)
    const relationships: RelationshipFact[] = []
    const seen = new Set<string>()  // 去重 (A,B) 和 (B,A)

    for (const c of prismaChars as any[]) {
      const rels = c.relations || []
      for (const r of rels) {
        const pairKey = [c.id, r.target].sort().join(':')
        if (seen.has(pairKey)) continue
        seen.add(pairKey)

        // 找对方角色的 ID
        const targetChar = (prismaChars as any[]).find((pc: any) => pc.name === r.target)
        relationships.push({
          id: uuid(),
          projectId,
          characterAId: c.id,
          characterAName: c.name,
          characterBId: targetChar?.id || '',
          characterBName: r.target || '',
          stages: [{
            type: mapRelationType(r.type),
            status: 'active',
            turningPoint: r.description || '初始关系',
            turningPointChapter: 0,
            trace: { chapterNo: 0, provenance: 'planner_outline' },
            from: new Date().toISOString(),
          }],
          currentType: mapRelationType(r.type),
          currentStatus: 'active',
          intensity: 50,
          powerBalance: 0,
          trustLevel: mapTrustLevel(r.type),
          trace: { chapterNo: 0, provenance: 'planner_outline' },
          active: true,
        })
      }
    }

    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'relationships.json', relationships)
    console.log(`[RelationshipRuntime] initialized ${relationships.length} relationships for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<RelationshipFact[]> {
    return narrativeRepository.readJson<RelationshipFact[]>(projectId, RUNTIME_NAME, 'relationships.json') || []
  }

  getRelationship(projectId: string, charAId: string, charBId: string): RelationshipFact | null {
    const all = narrativeRepository.readJson<RelationshipFact[]>(projectId, RUNTIME_NAME, 'relationships.json') || []
    return all.find(r =>
      (r.characterAId === charAId && r.characterBId === charBId) ||
      (r.characterAId === charBId && r.characterBId === charAId)
    ) || null
  }

  /** 获取某个角色的所有活跃关系 */
  getRelationshipsForCharacter(projectId: string, characterId: string): RelationshipFact[] {
    const all = narrativeRepository.readJson<RelationshipFact[]>(projectId, RUNTIME_NAME, 'relationships.json') || []
    return all.filter(r =>
      (r.characterAId === characterId || r.characterBId === characterId) && r.active
    )
  }

  /** 添加关系阶段转变（关系质变） */
  addStage(projectId: string, charAId: string, charBId: string, stage: Omit<RelationshipStage, 'from'>): void {
    const all = narrativeRepository.readJson<RelationshipFact[]>(projectId, RUNTIME_NAME, 'relationships.json') || []
    const idx = all.findIndex(r =>
      (r.characterAId === charAId && r.characterBId === charBId) ||
      (r.characterAId === charBId && r.characterBId === charAId)
    )
    if (idx === -1) return

    // 标记上一个阶段结束
    const lastStage = all[idx].stages[all[idx].stages.length - 1]
    if (lastStage && !lastStage.to) {
      all[idx].stages[all[idx].stages.length - 1].to = new Date().toISOString()
    }

    // 添加新阶段
    all[idx].stages.push({
      ...stage,
      from: new Date().toISOString(),
    })
    all[idx].currentType = stage.type
    all[idx].currentStatus = stage.status
    all[idx].version++
    all[idx].updatedAt = new Date().toISOString()

    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'relationships.json', all)
  }

  /** 更新关系指标 */
  updateMetrics(projectId: string, charAId: string, charBId: string, metrics: { intensity?: number; powerBalance?: number; trustLevel?: number }): void {
    const all = narrativeRepository.readJson<RelationshipFact[]>(projectId, RUNTIME_NAME, 'relationships.json') || []
    const idx = all.findIndex(r =>
      (r.characterAId === charAId && r.characterBId === charBId) ||
      (r.characterAId === charBId && r.characterBId === charAId)
    )
    if (idx === -1) return
    all[idx] = {
      ...all[idx],
      ...(metrics.intensity !== undefined ? { intensity: metrics.intensity } : {}),
      ...(metrics.powerBalance !== undefined ? { powerBalance: metrics.powerBalance } : {}),
      ...(metrics.trustLevel !== undefined ? { trustLevel: metrics.trustLevel } : {}),
      version: all[idx].version + 1,
      updatedAt: new Date().toISOString(),
    }
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'relationships.json', all)
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'relationships.json')
  }
}

// ─── Helper ───

function mapRelationType(type: string): BondType {
  const map: Record<string, BondType> = {
    '同门': 'colleague',
    '师徒': 'master_disciple',
    '恋人': 'romantic',
    '夫妻': 'romantic',
    '兄妹': 'familial',
    '姐弟': 'familial',
    '父子': 'familial',
    '母女': 'familial',
    '兄弟': 'familial',
    '好友': 'friendship',
    '敌人': 'enmity',
    '仇人': 'enmity',
    '盟友': 'alliance',
    '主仆': 'servitude',
    '师兄弟': 'colleague',
  }
  return map[type] || 'friendship'
}

function mapTrustLevel(type: string): number {
  const map: Record<string, number> = {
    '同门': 60,
    '师徒': 80,
    '恋人': 90,
    '夫妻': 95,
    '兄妹': 85,
    '好友': 70,
    '敌人': -80,
    '仇人': -90,
    '盟友': 50,
    '主仆': 40,
  }
  return map[type] || 0
}
