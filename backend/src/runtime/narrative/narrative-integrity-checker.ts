/**
 * NarrativeIntegrityChecker — NOS Runtime Integrity Validator
 * 
 * 职责：检测所有 Runtime 之间的一致性。
 * 
 * 不是测试工具，是 Runtime 的 Constitution 守护者。
 * 每次 Runtime 更新后应该调用 check() 确保数据真实且一致。
 * 
 * Phase 1.5 ─ Truth Validation
 */

import { narrativeRuntime } from './index.js'

// ─── 验证结果类型 ───

export type Severity = 'error' | 'warning' | 'info'

export interface IntegrityIssue {
  severity: Severity
  runtime: string
  category: string
  message: string
  /** 建议修复方式 */
  suggestion?: string
}

export interface IntegrityReport {
  projectId: string
  checkedAt: string
  issues: IntegrityIssue[]
  passed: boolean
  stats: {
    totalChecks: number
    errors: number
    warnings: number
    infos: number
  }
}

// ─── Runtime Constitution Rules ───

interface ConstitutionRule {
  name: string
  description: string
  check: (projectId: string) => Promise<IntegrityIssue[]>
}

// ─── Integrity Checker ───

export class NarrativeIntegrityChecker {
  private rules: ConstitutionRule[] = []

  constructor() {
    this.registerRules()
  }

  private registerRules(): void {
    this.rules = [
      // ═══ RULE 1: Character Lifecycle ↔ Event (死亡追溯) ═══
      {
        name: 'character-death-traceable',
        description: '任何标记为 dead 的角色，Event Runtime 中必须有对应的死亡事件',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const characters = await narrativeRuntime.character.getSnapshot(projectId)
          const events = await narrativeRuntime.event.getSnapshot(projectId)

          for (const c of characters) {
            if (c.lifecycle !== 'dead') continue
            // 查找该角色参与的、category 为 death 的事件
            const deathEvents = events.filter(
              (e: any) =>
                e.category === 'death' &&
                e.participants?.some((p: any) =>
                  p.characterId === c.characterId || p.characterName === c.characterName
                )
            )
            if (deathEvents.length === 0) {
              issues.push({
                severity: 'error',
                runtime: 'character',
                category: 'orphan_death',
                message: `"${c.characterName}" 标记为 dead 但 Event Runtime 中无死亡事件`,
                suggestion: `添加 Event: category=death, participants=[${c.characterName}]`,
              })
            }
          }
          return issues
        },
      },

      // ═══ RULE 2: Relationship ↔ Knowledge（关系认知一致） ═══
      {
        name: 'relationship-knowledge-consistency',
        description: '如果两人是夫妻/恋人，Knowledge Runtime 中不应同时标记为"不认识"',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const relationships = await narrativeRuntime.relationship.getSnapshot(projectId)
          const knowledge = await narrativeRuntime.knowledge.getSnapshot(projectId)

          for (const rel of relationships) {
            if (!rel.active) continue
            // 亲密关系检查
            if (rel.currentType !== 'romantic' && rel.currentType !== 'familial' && rel.currentType !== 'master_disciple') continue

            const aName = rel.characterAName
            const bName = rel.characterBName
            // 查 Knowledge：是否有一条 "不认识" 类型知识包含双方
            const gap = knowledge.filter((k: any) =>
              k.category === 'identity' &&
              k.knownBy.includes(aName) === false
            )
            // 简化版检查：找 describe 包含 "不认识" 的知识
            for (const k of knowledge) {
              if (k.description.includes('不认识') || k.description.includes('不认得')) {
                if (
                  (k.knownBy.includes(aName) && k.unknownBy.includes(bName)) ||
                  (k.knownBy.includes(bName) && k.unknownBy.includes(aName))
                ) {
                  issues.push({
                    severity: 'warning',
                    runtime: 'knowledge',
                    category: 'relationship_knowledge_mismatch',
                    message: `"${aName}" 与 "${bName}" 关系为 ${rel.currentType}，但 Knowledge 显示一方不认识另一方`,
                    suggestion: `检查 Knowledge "${k.description}" 是否仍有效，或更新 knownBy/unknownBy`,
                  })
                }
              }
            }
          }
          return issues
        },
      },

      // ═══ RULE 3: Foreshadow ↔ Timeline（伏笔回收窗口） ═══
      {
        name: 'foreshadow-timeline-exists',
        description: '伏笔中引用的预期回收章节必须在 Timeline 中存在',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const foreshadows = await narrativeRuntime.foreshadow.getSnapshot(projectId)
          const timeline = await narrativeRuntime.timeline.getSnapshot(projectId)
          const maxChapter = Math.max(...timeline.map((t: any) => t.chapterNo), 0)

          for (const f of foreshadows) {
            if (f.status !== 'planted' && f.status !== 'active') continue
            if (!f.expectedPayoffWindow) continue
            if (f.expectedPayoffWindow.toChapter > maxChapter) {
              issues.push({
                severity: 'warning',
                runtime: 'foreshadow',
                category: 'foreshadow_payoff_beyond_timeline',
                message: `伏笔"${f.description}" 预期回收至第 ${f.expectedPayoffWindow.toChapter} 章，但 Timeline 只到第 ${maxChapter} 章`,
                suggestion: `核实 expectedPayoffWindow.toChapter 是否正确，或更新 Timeline`,
              })
            }
          }
          return issues
        },
      },

      // ═══ RULE 4: Event ↔ Character（事件参与者存在性） ═══
      {
        name: 'event-participant-exists',
        description: '事件的参与角色必须在 Character Runtime 中存在',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const events = await narrativeRuntime.event.getSnapshot(projectId)
          const characters = await narrativeRuntime.character.getSnapshot(projectId)
          const charNames = new Set(characters.map((c: any) => c.characterName))
          const charIds = new Set(characters.map((c: any) => c.characterId))

          for (const e of events) {
            for (const p of (e.participants || [])) {
              if (p.characterId && !charIds.has(p.characterId)) {
                issues.push({
                  severity: 'error',
                  runtime: 'event',
                  category: 'participant_not_in_character',
                  message: `事件 "${e.title}" 的参与者 "${p.characterName}" (ID: ${p.characterId}) 不在 Character Runtime 中`,
                  suggestion: `添加角色或修正参与者 ID`,
                })
              }
              if (!p.characterId && !charNames.has(p.characterName)) {
                issues.push({
                  severity: 'warning',
                  runtime: 'event',
                  category: 'participant_name_unknown',
                  message: `事件 "${e.title}" 的参与者 "${p.characterName}" 不在 Character Runtime 中`,
                  suggestion: `确认角色名是否正确，或添加角色到 Character Runtime`,
                })
              }
            }
          }
          return issues
        },
      },

      // ═══ RULE 5: Trace Validation（每个 Fact 的可追溯性） ═══
      {
        name: 'trace-validation',
        description: '每个 Fact 必须有完整的追溯链：Fact → Trace (chapterNo + provenance)',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const [characters, events, relationships, foreshadows, knowledge, world] = await Promise.all([
            narrativeRuntime.character.getSnapshot(projectId),
            narrativeRuntime.event.getSnapshot(projectId),
            narrativeRuntime.relationship.getSnapshot(projectId),
            narrativeRuntime.foreshadow.getSnapshot(projectId),
            narrativeRuntime.knowledge.getSnapshot(projectId),
            narrativeRuntime.world.getSnapshot(projectId),
          ])

          // Character Runtime 追溯检查
          for (const c of characters) {
            if (!c.lifecycleTrace || !c.lifecycleTrace.chapterNo) {
              issues.push({
                severity: 'error',
                runtime: 'character',
                category: 'missing_trace',
                message: `"${c.characterName}" 的 lifecycleTrace 缺失 chapterNo`,
                suggestion: `追溯至事件或大纲关联的章节`,
              })
            }
            for (const f of (c.statusFlags || [])) {
              if (!f.trace?.chapterNo) {
                issues.push({
                  severity: 'warning',
                  runtime: 'character',
                  category: 'missing_trace',
                  message: `"${c.characterName}" 的 statusFlag "${f.flag}" 缺失 trace`,
                })
              }
            }
          }

          // Event Runtime 追溯检查
          for (const e of events) {
            if (!e.trace?.chapterNo) {
              issues.push({
                severity: 'error',
                runtime: 'event',
                category: 'missing_trace',
                message: `事件 "${e.title}" 缺失 trace.chapterNo`,
              })
            }
          }

          // Relationship Runtime 追溯检查
          for (const r of relationships) {
            if (!r.trace?.chapterNo) {
              issues.push({
                severity: 'warning',
                runtime: 'relationship',
                category: 'missing_trace',
                message: `关系 "${r.characterAName} ↔ ${r.characterBName}" 缺失 trace`,
              })
            }
            for (const s of (r.stages || [])) {
              if (!s.trace?.chapterNo && !s.trace?.evidence) {
                issues.push({
                  severity: 'info',
                  runtime: 'relationship',
                  category: 'stage_missing_trace',
                  message: `关系 "${r.characterAName} ↔ ${r.characterBName}" 的阶段 "${s.trace?.turningPoint || 'unknown'}" 缺失 trace`,
                })
              }
            }
          }

          // Foreshadow Runtime 追溯检查
          for (const f of foreshadows) {
            if (!f.trace?.chapterNo) {
              issues.push({
                severity: 'warning',
                runtime: 'foreshadow',
                category: 'missing_trace',
                message: `伏笔 "${f.description}" 缺失 trace`,
              })
            }
          }

          // World Runtime 追溯检查
          if (world) {
            const w = world as any
            if (w.worldState && !w.worldState.trace?.chapterNo) {
              issues.push({
                severity: 'warning',
                runtime: 'world',
                category: 'missing_trace',
                message: `WorldState 缺失 trace`,
              })
            }
            for (const faction of (w.factions || [])) {
              if (!faction.trace?.chapterNo) {
                issues.push({
                  severity: 'info',
                  runtime: 'world',
                  category: 'missing_trace',
                  message: `势力 "${faction.name}" 缺失 trace`,
                })
              }
            }
          }

          // Knowledge Runtime 追溯检查
          for (const k of knowledge) {
            if (!k.trace?.chapterNo) {
              issues.push({
                severity: 'info',
                runtime: 'knowledge',
                category: 'missing_trace',
                message: `知识 "${k.description}" 缺失 trace`,
              })
            }
          }

          return issues
        },
      },

      // ═══ RULE 6: Event ↔ Timeline（事件时间一致性） ═══
      {
        name: 'event-timeline-consistency',
        description: '事件引用的 chapterNo 必须在 Timeline 中存在',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const events = await narrativeRuntime.event.getSnapshot(projectId)
          const timeline = await narrativeRuntime.timeline.getSnapshot(projectId)
          const chapterSet = new Set(timeline.map((t: any) => t.chapterNo))

          for (const e of events) {
            if (!chapterSet.has(e.chapterNo)) {
              issues.push({
                severity: 'error',
                runtime: 'event',
                category: 'chapter_not_in_timeline',
                message: `事件 "${e.title}" 引用第 ${e.chapterNo} 章，但 Timeline 中无此章节`,
                suggestion: `检查 chapterNo 是否正确，或补充 Timeline`,
              })
            }
          }
          return issues
        },
      },

      // ═══ RULE 7: Void Check — 空 Runtime 检测 ═══
      {
        name: 'void-check',
        description: '检查是否存在意外为空的 Runtime（不应为空但为空）',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const timeline = await narrativeRuntime.timeline.getSnapshot(projectId)
          const characters = await narrativeRuntime.character.getSnapshot(projectId)

          if (timeline.length === 0) {
            issues.push({
              severity: 'error',
              runtime: 'timeline',
              category: 'empty_runtime',
              message: 'Timeline Runtime 为空（至少有初始化条目）',
              suggestion: '重新初始化 Timeline',
            })
          }

          if (characters.length === 0) {
            issues.push({
              severity: 'error',
              runtime: 'character',
              category: 'empty_runtime',
              message: 'Character Runtime 为空',
              suggestion: '重新初始化 Character Runtime',
            })
          }

          return issues
        },
      },

      // ═══ RULE 8: Inventory ↔ Character（物品持有者存在性） ═══
      {
        name: 'inventory-owner-exists',
        description: 'Inventory 中的物品持有者必须在 Character Runtime 中存在',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const inventory = await narrativeRuntime.inventory.getSnapshot(projectId)
          const characters = await narrativeRuntime.character.getSnapshot(projectId)
          const charIds = new Set(characters.map((c: any) => c.characterId))
          const charNames = new Set(characters.map((c: any) => c.characterName))

          for (const item of inventory) {
            if (item.ownerCharacterId && !charIds.has(item.ownerCharacterId)) {
              issues.push({
                severity: 'error',
                runtime: 'inventory',
                category: 'owner_not_in_character',
                message: `物品 "${item.itemName}" 的持有者 ID "${item.ownerCharacterId}" 不在 Character Runtime 中`,
              })
            }
            if (!item.ownerCharacterId && !charNames.has(item.ownerCharacterName)) {
              issues.push({
                severity: 'warning',
                runtime: 'inventory',
                category: 'owner_name_unknown',
                message: `物品 "${item.itemName}" 的持有者 "${item.ownerCharacterName}" 不在 Character Runtime 中`,
              })
            }
          }
          return issues
        },
      },

      // ═══ RULE 9: Organization ↔ Character（组织成员存在性） ═══
      {
        name: 'organization-member-exists',
        description: '组织的首领和成员必须在 Character Runtime 中存在',
        check: async (projectId: string) => {
          const issues: IntegrityIssue[] = []
          const organizations = await narrativeRuntime.organization.getSnapshot(projectId)
          const characters = await narrativeRuntime.character.getSnapshot(projectId)
          const charNames = new Set(characters.map((c: any) => c.characterName))

          for (const org of organizations) {
            for (const leader of (org.leaderHistory || [])) {
              if (!charNames.has(leader.characterName) && leader.characterName) {
                issues.push({
                  severity: 'warning',
                  runtime: 'organization',
                  category: 'leader_not_in_character',
                  message: `组织 "${org.name}" 的首领 "${leader.characterName}" 不在 Character Runtime 中`,
                })
              }
            }
          }
          return issues
        },
      },
    ]
  }

  // ─── 执行完整性检查 ───

  async check(projectId: string): Promise<IntegrityReport> {
    const start = Date.now()
    const allIssues: IntegrityIssue[] = []

    for (const rule of this.rules) {
      try {
        const issues = await rule.check(projectId)
        allIssues.push(...issues)
      } catch (err) {
        allIssues.push({
          severity: 'error',
          runtime: '__checker__',
          category: 'rule_failure',
          message: `规则 "${rule.name}" 执行失败: ${(err as Error).message}`,
        })
      }
    }

    const errors = allIssues.filter(i => i.severity === 'error').length
    const warnings = allIssues.filter(i => i.severity === 'warning').length
    const infos = allIssues.filter(i => i.severity === 'info').length

    const report: IntegrityReport = {
      projectId,
      checkedAt: new Date().toISOString(),
      issues: allIssues,
      passed: errors === 0,
      stats: {
        totalChecks: this.rules.length,
        errors,
        warnings,
        infos,
      },
    }

    const elapsed = Date.now() - start
    console.log(`[IntegrityChecker] project=${projectId} result=${report.passed ? 'PASS' : 'FAIL'} errors=${errors} warnings=${warnings} infos=${infos} (${elapsed}ms)`)

    if (errors > 0) {
      for (const issue of allIssues.filter(i => i.severity === 'error')) {
        console.error(`[IntegrityChecker] ERROR [${issue.runtime}] ${issue.message}`)
      }
    }

    return report
  }

  /**
   * 快速检查：只检查指定的规则子集
   */
  async checkRules(projectId: string, ruleNames: string[]): Promise<IntegrityReport> {
    const rules = this.rules.filter(r => ruleNames.includes(r.name))
    if (rules.length === 0) {
      return {
        projectId,
        checkedAt: new Date().toISOString(),
        issues: [],
        passed: true,
        stats: { totalChecks: 0, errors: 0, warnings: 0, infos: 0 },
      }
    }
    // 临时替换 rules 列表
    const restored = this.rules
    this.rules = rules
    const report = await this.check(projectId)
    this.rules = restored
    return report
  }

  /**
   * 获取所有注册的规则名称
   */
  listRules(): { name: string; description: string }[] {
    return this.rules.map(r => ({ name: r.name, description: r.description }))
  }
}

// ─── 单例 ───
export const integrityChecker = new NarrativeIntegrityChecker()
