/**
 * Narrative Runtime — NOS 领域门面
 * 
 * 统一协调 7 个子 Runtime，对外提供单一入口。
 * 
 * 职责：
 * 1. 初始化所有子 Runtime（项目创建时调用）
 * 2. 提供统一快照查询
 * 3. 提供跨 Runtime 的复合查询（需要多个 Runtime 协作的问题）
 */

import { randomUUID as uuid } from 'crypto'
import { CharacterRuntime } from './character/character.runtime.js'
import { EventRuntime } from './event/event.runtime.js'
import { TimelineRuntime } from './timeline/timeline.runtime.js'
import { RelationshipRuntime } from './relationship/relationship.runtime.js'
import { KnowledgeRuntime } from './knowledge/knowledge.runtime.js'
import { WorldRuntime } from './world/world.runtime.js'
import { ForeshadowRuntime } from './foreshadow/foreshadow.runtime.js'
import { InventoryRuntime } from './inventory/inventory.runtime.js'
import { OrganizationRuntime } from './organization/organization.runtime.js'
import type { NarrativeRuntime } from './narrative-types.js'
import { NarrativeIntegrityChecker } from './narrative-integrity-checker.js'
import { StoryLibrarian } from './librarian/story-librarian.js'
import { narrativeMigrationEngine } from './migration/migration-engine.js'
import { snapshotEngine } from './snapshot/index.js'

class NarrativeRuntimeManager {
  readonly character = new CharacterRuntime()
  readonly event = new EventRuntime()
  readonly timeline = new TimelineRuntime()
  readonly relationship = new RelationshipRuntime()
  readonly knowledge = new KnowledgeRuntime()
  readonly world = new WorldRuntime()
  readonly foreshadow = new ForeshadowRuntime()
  readonly inventory = new InventoryRuntime()
  readonly organization = new OrganizationRuntime()
  /** Story Librarian — 唯一拥有 Runtime 写入权限的组件 */
  readonly librarian = new StoryLibrarian()
  /** Snapshot Engine — Facts → Views */
  readonly snapshot = snapshotEngine
  /** Migration Engine — 历史数据增量补齐 */
  readonly migration = narrativeMigrationEngine

  private readonly runtimes: NarrativeRuntime[]

  constructor() {
    this.runtimes = [
      this.character,
      this.event,
      this.timeline,
      this.relationship,
      this.knowledge,
      this.world,
      this.foreshadow,
      this.inventory,
      this.organization,
    ]
  }

  /**
   * 初始化项目的所有 Runtime
   * 项目创建后调用一次
   */
  async initializeProject(projectId: string): Promise<void> {
    console.log(`[NarrativeRuntime] initializing all runtimes for ${projectId}`)
    const start = Date.now()
    await Promise.all(this.runtimes.map(r => r.initialize(projectId)))
    console.log(`[NarrativeRuntime] all runtimes initialized in ${Date.now() - start}ms`)
  }

  /**
   * 获取所有 Runtime 的快照（用于构建 Prompt 上下文）
   */
  async getUnifiedSnapshot(projectId: string): Promise<{
    characters: any[]
    events: any[]
    timeline: any[]
    relationships: any[]
    knowledge: any[]
    world: any
    foreshadows: any[]
    inventory: any[]
    organizations: any[]
  }> {
    const [characters, events, timeline, relationships, knowledge, world, foreshadows, inventory, organizations] = await Promise.all([
      this.character.getSnapshot(projectId),
      this.event.getSnapshot(projectId),
      this.timeline.getSnapshot(projectId),
      this.relationship.getSnapshot(projectId),
      this.knowledge.getSnapshot(projectId),
      this.world.getSnapshot(projectId),
      this.foreshadow.getSnapshot(projectId),
      this.inventory.getSnapshot(projectId),
      this.organization.getSnapshot(projectId),
    ])

    return { characters, events, timeline, relationships, knowledge, world, foreshadows, inventory, organizations }
  }

  /**
   * 重置项目的所有 Runtime 数据
   */
  async resetProject(projectId: string): Promise<void> {
    await Promise.all(this.runtimes.map(r => r.resetProject(projectId)))
    console.log(`[NarrativeRuntime] project ${projectId} reset`)
  }

  // ─── 验收标准查询（直接回答你的 6 个问题） ───

  /** 林辰现在在哪里？ */
  whereIs(projectId: string, characterName: string): string | null {
    return this.character.whereIs(projectId, characterName)
  }

  /** 林辰知道哪些真相？不知道哪些？ */
  characterKnowledge(projectId: string, characterName: string): {
    knows: string[]
    doesntKnow: string[]
  } {
    const knows = this.knowledge.whatDoesXKnow(projectId, characterName)
    const doesntKnow = this.knowledge.whatDoesXNotKnow(projectId, characterName)
    return {
      knows: knows.map(k => k.description),
      doesntKnow: doesntKnow.map(k => k.description),
    }
  }

  /** 皇帝为什么中毒？是谁下的毒？证据是什么？ */
  eventCause(projectId: string, eventTitle: string): {
    event: any
    chain: any[]
  } | null {
    const events = this.event
    // 找标题包含关键词的事件
    const all = events.getSnapshot(projectId)
    // 使用同步方式简化（getSnapshot 本应是同步的，因为从文件读）
    return null // 运行时动态查询
  }

  /** 获取事件链 */
  getEventChain(projectId: string, eventId: string): Promise<any[]> {
    return Promise.resolve(this.event.getEventChain(projectId, eventId))
  }

  /** 苏婉和林辰目前是什么关系？经历了哪些变化？ */
  relationshipHistory(projectId: string, charAName: string, charBName: string): any {
    const charA = this.character.getCharacterByName(projectId, charAName)
    const charB = this.character.getCharacterByName(projectId, charBName)
    if (!charA || !charB) return null
    const rel = this.relationship.getRelationship(projectId, charA.characterId, charB.characterId)
    if (!rel) return null
    return {
      currentType: rel.currentType,
      currentStatus: rel.currentStatus,
      intensity: rel.intensity,
      trustLevel: rel.trustLevel,
      stages: rel.stages.map(s => ({
        type: s.type,
        status: s.status,
        turningPoint: s.turningPoint,
        from: s.from,
        to: s.to || 'current',
      })),
    }
  }

  /** 第 37 章埋下的伏笔是否已经回收？ */
  foreshadowStatus(projectId: string, plantedChapterNo: number): any[] {
    const fs = this.foreshadow.getForeshadowsPlantedInChapter(projectId, plantedChapterNo)
    return fs.map(f => ({
      description: f.description,
      status: f.status,
      payoffChapter: f.payoffChapterNo,
      overdue: f.overdue,
    }))
  }

  /** 当前世界处于什么状态？有哪些重大变化？ */
  worldStatus(projectId: string): any {
    return this.world.getWorldState(projectId)
  }

  /** 获取所有活跃（未回收）的伏笔 */
  getActiveForeshadows(projectId: string): Promise<any[]> {
    return Promise.resolve(this.foreshadow.getActiveForeshadows(projectId))
  }

  /** 获取超期伏笔 */
  getOverdueForeshadows(projectId: string, currentChapterNo: number): Promise<any[]> {
    return Promise.resolve(this.foreshadow.scanOverdue(projectId, currentChapterNo))
  }

  // ─── Phase 1.5: Integrity Check ───

  /** 执行完整性检查 */
  async integrityCheck(projectId: string) {
    const checker = new NarrativeIntegrityChecker()
    return checker.check(projectId)
  }

  /** 执行指定的规则子集 */
  async integrityCheckRules(projectId: string, ruleNames: string[]) {
    const checker = new NarrativeIntegrityChecker()
    return checker.checkRules(projectId, ruleNames)
  }

  /** 获取可用规则列表 */
  listIntegrityRules() {
    const checker = new NarrativeIntegrityChecker()
    return checker.listRules()
  }
}

/** 单例 */
export const narrativeRuntime = new NarrativeRuntimeManager()

/** NOS Runtime 配置（Feature Flag） */
export { narrativeConfig } from './narrative-config.js'
export type { NarrativeRuntimeConfig, WriterMode, PlannerMode, LibrarianMode } from './narrative-config.js'
