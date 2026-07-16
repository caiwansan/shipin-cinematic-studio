/**
 * Story Librarian — Narrative Truth Maintainer
 * 
 * 不是 Summary Generator。
 * 不是 Memory Updater。
 * 是：维护小说真相的唯一入口。
 * 
 * 任何 Agent 都不能直接修改 Runtime。
 * 只有 Story Librarian 拥有 Commit 权限。
 * 
 * 工作流：
 *   Writer → Raw Chapter
 *         → StoryLibrarian.process(chapter)
 *              → Extract Facts
 *              → Validate Events
 *              → Update Runtimes
 *              → Integrity Check
 *              → Commit / Rollback
 */

import { narrativeRuntime } from '../index.js'
import { integrityChecker } from '../narrative-integrity-checker.js'
import type { TraceInfo, EventCategory, EventFact } from '../narrative-types.js'
import { extractFactsFromChapter } from './fact-extractor.js'

// ─── 输入/输出类型 ───

export interface ChapterInput {
  projectId: string
  userId: string
  chapterNo: number
  chapterTitle: string
  content: string
  /** POV 角色 */
  povCharacter?: string
}

export interface ExtractedFact {
  /** fact 类型 */
  type: 'character_event' | 'character_state' | 'relationship' | 'knowledge' | 'world' | 'foreshadow' | 'item' | 'organization'
  /** 描述 */
  description: string
  /** 关联角色名 */
  characterName?: string
  /** 关联对象名（物品/组织名） */
  targetName?: string
  /** 具体数值或状态 */
  value?: string
  /** 正文证据（摘录原文） */
  evidence: string
  /** 置信度 0-1 */
  confidence: number
}

export interface ExtractedEvent {
  title: string
  description: string
  category: EventCategory
  participants: Array<{
    characterName: string
    role: 'initiator' | 'target' | 'witness' | 'bystander'
  }>
  locationName?: string
  /** 事件造成的后果描述 */
  consequences: string[]
  /** 涉及的伏笔 */
  relatedForeshadowIds?: string[]
}

export interface LibrarianReport {
  success: boolean
  projectId: string
  chapterNo: number
  stats: {
    eventsCreated: number
    charactersUpdated: number
    relationshipsUpdated: number
    knowledgeAdded: number
    worldUpdated: number
    foreshadowsUpdated: number
    inventoryUpdated: number
    organizationsUpdated: number
    errors: number
  }
  integrityPassed: boolean
  rollbackPerformed: boolean
  details: string[]
}

// ─── Story Librarian ───

export class StoryLibrarian {
  /**
   * 处理一章正文——完整 Pipeline：
   * Extract → Validate → Update → Integrity → Commit
   */
  async process(chapter: ChapterInput): Promise<LibrarianReport> {
    const { projectId, userId, chapterNo, content, chapterTitle, povCharacter } = chapter
    const report: LibrarianReport = {
      success: false,
      projectId,
      chapterNo,
      stats: {
        eventsCreated: 0,
        charactersUpdated: 0,
        relationshipsUpdated: 0,
        knowledgeAdded: 0,
        worldUpdated: 0,
        foreshadowsUpdated: 0,
        inventoryUpdated: 0,
        organizationsUpdated: 0,
        errors: 0,
      },
      integrityPassed: false,
      rollbackPerformed: false,
      details: [],
    }

    // 备份当前 Runtime（用于 rollback）
    const snapshot = await this.backupRuntime(projectId)
    const commitLog: string[] = []

    try {
      // Step 1: Ensure Runtime exists
      await this.ensureRuntimeInitialized(projectId)
      commitLog.push(`[1/7] Runtime initialized/verified`)

      // Step 2: Extract raw facts from chapter (LLM 驱动，fallback 到规则提取)
      const [events, facts] = await extractFactsFromChapter(projectId, userId, chapterNo, content, chapterTitle, povCharacter)
      commitLog.push(`[2/7] Extracted ${events.length} events, ${facts.length} raw facts`)
      report.details.push(`提取 ${events.length} 个事件, ${facts.length} 个原始事实`)

      // Step 3: Create Events first (Events are the source of truth)
      for (const ev of events) {
        const created = narrativeRuntime.event.addEvent(projectId, {
          title: ev.title,
          description: ev.description,
          category: ev.category,
          chapterNo,
          storyTime: { chapterNo, sortOrder: chapterNo },
          participants: ev.participants.map(p => ({
            characterId: '',  // 运行时用 name 匹配
            characterName: p.characterName,
            role: p.role,
          })),
          locationName: ev.locationName,
          consequences: ev.consequences.map(c => ({
            type: 'character_status_change' as const,
            factId: '',
            description: c,
          })),
          foreshadowIds: ev.relatedForeshadowIds || [],
          trace: { chapterNo, provenance: 'event_extraction', evidence: `Chapter ${chapterNo}: ${chapterTitle}` },
        })
        report.stats.eventsCreated++
        commitLog.push(`  Event: ${created.title}`)
      }
      report.details.push(`创建 ${report.stats.eventsCreated} 个事件`)

      // Step 4: Apply facts to Runtime
      for (const fact of facts) {
        this.applyFact(projectId, chapterNo, fact, report, commitLog)
      }

      // Step 5: Link events to Timeline
      const eventsInChapter = narrativeRuntime.event.getEventsByChapter(projectId, chapterNo)
      for (const e of eventsInChapter) {
        narrativeRuntime.timeline.linkEvent(projectId, chapterNo, e.id)
      }

      // Step 6: Update Timeline summary
      narrativeRuntime.timeline.updateSummary(projectId, chapterNo, this.summarizeChapter(facts))
      commitLog.push(`[6/7] Timeline updated`)

      // Step 7: Integrity Check — fail = rollback
      const integrity = await integrityChecker.check(projectId)
      report.integrityPassed = integrity.passed
      commitLog.push(`[7/7] Integrity: ${integrity.passed ? 'PASS' : 'FAIL'} (${integrity.stats.errors} errors, ${integrity.stats.warnings} warnings)`)

      if (!integrity.passed) {
        await this.rollbackRuntime(projectId, snapshot)
        report.rollbackPerformed = true
        report.details.push(`❌ Integrity 失败，回滚: ${integrity.stats.errors} errors`)
        for (const issue of integrity.issues.filter(i => i.severity === 'error').slice(0, 5)) {
          report.details.push(`  ERROR: ${issue.message}`)
        }
        return report
      }

      report.success = true
      report.details.push(`✅ Chapter ${chapterNo} 处理完成`)

      return report

    } catch (err) {
      // 发生异常——回滚
      await this.rollbackRuntime(projectId, snapshot)
      report.rollbackPerformed = true
      report.stats.errors++
      report.details.push(`❌ 异常回滚: ${(err as Error).message}`)
      return report
    }
  }

  // ─── Apply Fact — 将提取的事实同步到 Runtime ───

  private applyFact(
    projectId: string, chapterNo: number, fact: ExtractedFact,
    report: LibrarianReport, commitLog: string[]
  ): void {
    const trace: TraceInfo = {
      chapterNo,
      provenance: 'event_extraction',
      evidence: fact.evidence.substring(0, 200),
    }

    switch (fact.type) {
      case 'character_state': {
        // 角色状态变化：由 Event 驱动，此处为补充更新
        if (fact.characterName) {
          const char = narrativeRuntime.character.getCharacterByName(projectId, fact.characterName)
          if (char && fact.value) {
            // 暂时只是标记更新计数
            report.stats.charactersUpdated++
            commitLog.push(`  Character state: ${fact.characterName} → ${fact.value}`)
          }
        }
        break
      }

      case 'relationship': {
        if (fact.characterName && fact.targetName) {
          const charA = narrativeRuntime.character.getCharacterByName(projectId, fact.characterName)
          const charB = narrativeRuntime.character.getCharacterByName(projectId, fact.targetName)
          if (charA && charB) {
            const existing = narrativeRuntime.relationship.getRelationship(projectId, charA.characterId, charB.characterId)
            if (existing) {
              // 已有关系 → 添加阶段
              narrativeRuntime.relationship.addStage(projectId, charA.characterId, charB.characterId, {
                type: mapValueToBondType(fact.value || fact.description),
                status: 'active',
                turningPoint: fact.description,
                turningPointChapter: chapterNo,
                trace,
              })
              // 更新信任度/亲密度
              if (fact.value) {
                const trustDelta = fact.value.includes('裂') || fact.value.includes('敌') ? -30 :
                                   fact.value.includes('携手') || fact.value.includes('和解') ? 30 : 0
                narrativeRuntime.relationship.updateMetrics(projectId, charA.characterId, charB.characterId, {
                  trustLevel: Math.max(-100, Math.min(100, (existing.trustLevel || 0) + trustDelta)),
                })
              }
            }
          }
        }
        report.stats.relationshipsUpdated++
        commitLog.push(`  Relationship: ${fact.description}`)
        break
      }

      case 'knowledge': {
        // 新知识
        narrativeRuntime.knowledge.addKnowledge(projectId, {
          description: fact.description,
          category: 'secret',
          knownBy: fact.characterName ? [fact.characterName] : [],
          unknownBy: [],
          sourceEventId: undefined,
          revealedChapterNo: chapterNo,
          isAccurate: true,
          trace,
        })
        report.stats.knowledgeAdded++
        commitLog.push(`  Knowledge: ${fact.description}`)
        break
      }

      case 'world': {
        // 世界观变化
        narrativeRuntime.world.addWorldChange(projectId, {
          chapterNo,
          change: fact.description,
          impact: 'moderate',
        })
        report.stats.worldUpdated++
        break
      }

      case 'foreshadow': {
        // 埋下/激活/回收伏笔
        narrativeRuntime.foreshadow.plant(projectId, {
          description: fact.description,
          category: 'plot',
          plantedChapterNo: chapterNo,
          expectedPayoffWindow: {
            fromChapter: chapterNo + 5,
            toChapter: chapterNo + 50,
          },
          relatedCharacterIds: fact.characterName ? [fact.characterName] : [],
          relatedEventIds: [],
          trace,
        })
        report.stats.foreshadowsUpdated++
        break
      }

      case 'item': {
        if (fact.characterName && fact.targetName) {
          const char = narrativeRuntime.character.getCharacterByName(projectId, fact.characterName)
          if (char) {
            narrativeRuntime.inventory.acquire(projectId, {
              itemName: fact.targetName,
              itemType: 'other',
              description: fact.description,
              ownerCharacterId: char.characterId,
              ownerCharacterName: char.characterName,
              originalOwnerId: char.characterId,
              originalOwnerName: char.characterName,
              relatedEventIds: [],
              relatedForeshadowIds: [],
              trace,
            })
          }
        }
        report.stats.inventoryUpdated++
        break
      }

      case 'organization': {
        if (fact.targetName) {
          const existing = narrativeRuntime.organization.getByName(projectId, fact.targetName)
          if (!existing) {
            narrativeRuntime.organization.create(projectId, {
              name: fact.targetName,
              type: 'sect',
              description: fact.description,
              leaderHistory: fact.characterName ? [{
                characterId: '',
                characterName: fact.characterName,
                title: '宗主',
                fromChapter: chapterNo,
              }] : [],
              memberIds: fact.characterName ? [] : [],
              memberCountLevel: 'moderate',
              controlledLocations: [],
              enemyOrganizationIds: [],
              allyOrganizationIds: [],
              subordinateOrganizationIds: [],
              relatedEventIds: [],
              initialStatus: 'founding',
              trace,
            })
          }
        }
        report.stats.organizationsUpdated++
        break
      }
    }
  }

  // ─── Runtime Snapshot（用于 Rollback） ───

  private async backupRuntime(projectId: string): Promise<string> {
    // 简单备份：把当前各 Runtime 的 JSON 文件路径和内容保存
    const fs = await import('fs')
    const path = await import('path')
    const baseDir = path.resolve(process.cwd(), 'data/runtime/narrative', projectId)
    const backupId = `backup-${Date.now()}`

    try {
      if (!fs.existsSync(baseDir)) return backupId
      const backupDir = path.resolve(process.cwd(), 'data/runtime/narrative', `.backup-${projectId}-${backupId}`)
      fs.cpSync(baseDir, backupDir, { recursive: true, force: true })
      return backupId
    } catch {
      return backupId
    }
  }

  private async rollbackRuntime(projectId: string, backupId: string): Promise<void> {
    const fs = await import('fs')
    const path = await import('path')
    const backupDir = path.resolve(process.cwd(), 'data/runtime/narrative', `.backup-${projectId}-${backupId}`)
    const targetDir = path.resolve(process.cwd(), 'data/runtime/narrative', projectId)

    try {
      if (fs.existsSync(backupDir)) {
        // 销毁当前数据
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true })
        }
        // 从备份恢复
        fs.cpSync(backupDir, targetDir, { recursive: true, force: true })
        // 清理备份
        fs.rmSync(backupDir, { recursive: true, force: true })
        console.log(`[StoryLibrarian] ✅ Rolled back project ${projectId}`)
      }
    } catch (err) {
      console.error(`[StoryLibrarian] ❌ Rollback failed: ${(err as Error).message}`)
    }
  }

  // ─── Helpers ───

  private async ensureRuntimeInitialized(projectId: string): Promise<void> {
    try {
      await narrativeRuntime.initializeProject(projectId)
    } catch {
      // 已初始化则跳过
    }
  }

  private summarizeChapter(facts: ExtractedFact[]): string {
    if (facts.length === 0) return ''
    const events = facts.filter(f => f.type === 'character_event')
    const states = facts.filter(f => f.type === 'character_state')
    const lines: string[] = []
    if (events.length > 0) lines.push(`事件: ${events.map(e => e.description).join('; ')}`)
    if (states.length > 0) lines.push(`状态变化: ${states.map(s => `${s.characterName}: ${s.value}`).join('; ')}`)
    return lines.join(' | ')
  }
}

// ─── 辅助函数 ───

function mapValueToBondType(value: string): import('../narrative-types.js').BondType {
  if (value.includes('敌人') || value.includes('仇') || value.includes('恨')) return 'enmity'
  if (value.includes('背叛') || value.includes('叛')) return 'betrayal'
  if (value.includes('恋') || value.includes('夫妻') || value.includes('妻')) return 'romantic'
  if (value.includes('师') || value.includes('徒')) return 'master_disciple'
  if (value.includes('盟友') || value.includes('同盟') || value.includes('联')) return 'alliance'
  if (value.includes('友') || value.includes('兄') || value.includes('弟')) return 'friendship'
  if (value.includes('家') || value.includes('亲')) return 'familial'
  if (value.includes('主') || value.includes('仆')) return 'servitude'
  if (value.includes('竞') || value.includes('对')) return 'rivalry'
  return 'friendship'
}

/** 单例 */
export const storyLibrarian = new StoryLibrarian()
