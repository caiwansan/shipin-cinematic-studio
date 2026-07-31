/**
 * services/hdz/consistency-verifier.service.ts — Phase X Consistency Verifier
 *
 * 一致性校验器：替代 Reviewerr 的评分逻辑，做事实层面的验证。
 *
 * 检查 5 个维度：
 * 1. entity existence —— state_delta 中的实体必须已注册
 * 2. timeline monotonicity —— 时间线不能回退
 * 3. inventory consistency —— 物品不能凭空消失/出现（需剧情驱动）
 * 4. relationship conflicts —— 关系变更不能与已确认的设定矛盾
 * 5. forbidden transitions —— 禁止的状态转换（如复生）
 *
 * 输出：PASS | FAIL + diff_report
 */

import { eventLogRepository } from './repositories/event-log.repository.js'
import { getWorldState, getEntityState, type StateDelta, type EntityState } from './world-state.service.js'
import { getEntityById } from './entity-registry.service.js'
import { emitEvent } from './event-log.service.js'
import { prisma } from '../../utils/index.js'

// ─── 类型定义 ───

export type Verdict = 'PASS' | 'MINOR_ISSUE' | 'FAIL'

export interface VerificationResult {
  verdict: Verdict
  score: number            // 0-100
  checks: CheckResult[]
  diffReport: string
}

export interface CheckResult {
  check: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

// ─── Consistency Verifier ───

class ConsistencyVerifier {
  /**
   * 执行全维度一致性校验
   *
   * @param projectId 项目ID
   * @param deltas Writer 输出的 state_delta
   * @param chapterNo 当前章节号
   * @param writerRaw 原始 Writer 输出（用于记录，非校验输入）
   */
  async verify(
    projectId: string,
    deltas: StateDelta[],
    chapterNo: number,
    writerRaw?: string,
  ): Promise<VerificationResult> {
    const checks: CheckResult[] = []
    let totalScore = 100

    // ── 1. entity existence ──
    const existenceResult = await this.checkEntityExistence(projectId, deltas)
    checks.push(existenceResult)
    if (existenceResult.status === 'fail') totalScore -= 25
    else if (existenceResult.status === 'warn') totalScore -= 10

    // ── 2. timeline monotonicity ──
    const timelineResult = await this.checkTimelineMonotonicity(projectId, deltas, chapterNo)
    checks.push(timelineResult)
    if (timelineResult.status === 'fail') totalScore -= 20
    else if (timelineResult.status === 'warn') totalScore -= 5

    // ── 3. inventory consistency ──
    const invResult = await this.checkInventoryConsistency(projectId, deltas)
    checks.push(invResult)
    if (invResult.status === 'fail') totalScore -= 20
    else if (invResult.status === 'warn') totalScore -= 5

    // ── 4. relationship conflicts ──
    const relResult = await this.checkRelationshipConflicts(projectId, deltas)
    checks.push(relResult)
    if (relResult.status === 'fail') totalScore -= 20
    else if (relResult.status === 'warn') totalScore -= 5

    // ── 5. forbidden transitions ──
    const forbResult = await this.checkForbiddenTransitions(projectId, deltas)
    checks.push(forbResult)
    if (forbResult.status === 'fail') totalScore -= 25
    else if (forbResult.status === 'warn') totalScore -= 10

    // ── 汇总 ──
    totalScore = Math.max(0, totalScore)
    const failCount = checks.filter(c => c.status === 'fail').length
    const warnCount = checks.filter(c => c.status === 'warn').length

    let verdict: Verdict
    if (failCount > 0) verdict = 'FAIL'
    else if (warnCount > 1 || totalScore < 85) verdict = 'MINOR_ISSUE'
    else verdict = 'PASS'

    const diffReport = this.buildDiffReport(checks, totalScore)

    // 记录校验事件
    try {
      await eventLogRepository.create({
        data: {
          entityType: 'chapter',
          entityId: `${projectId}:${chapterNo}`,
          eventType: 'CONSISTENCY_VERIFICATION',
          payload: { verdict, score: totalScore, checks: checks.map(c => ({ check: c.check, status: c.status })) },
        },
      })
    } catch {
      // 非关键失败
    }

    console.log(`[ConsistencyVerifier] ch${chapterNo}: ${verdict} score=${totalScore}, fail=${failCount}, warn=${warnCount}`)

    return { verdict, score: totalScore, checks, diffReport }
  }

  /**
   * 检查 state_delta 中所有实体是否已注册
   */
  private async checkEntityExistence(projectId: string, deltas: StateDelta[]): Promise<CheckResult> {
    const missing: string[] = []
    for (const delta of deltas) {
      const entity = await getEntityById(delta.entityId)
      if (!entity || entity.projectId !== projectId) {
        missing.push(delta.entityId)
      }
    }
    if (missing.length === 0) {
      return { check: 'entity_existence', status: 'pass', detail: `全部 ${deltas.length} 个实体已注册` }
    }
    return {
      check: 'entity_existence',
      status: 'fail',
      detail: `${missing.length} 个未注册实体: ${missing.join(', ')}`,
    }
  }

  /**
   * 检查时间线单调性 —— 章节号不能回退
   */
  private async checkTimelineMonotonicity(
    projectId: string,
    deltas: StateDelta[],
    chapterNo: number,
  ): Promise<CheckResult> {
    // 检查当前章节的 state_delta 是否引用比本回更晚的章节事实
    // （避免 Writer「提前知道」未来的事）
    const issues: string[] = []
    for (const delta of deltas) {
      if (delta.statusFlagChanges?.timeline_progression !== undefined) {
        if (typeof delta.statusFlagChanges.timeline_progression === 'number') {
          if (delta.statusFlagChanges.timeline_progression < chapterNo) {
            issues.push(`实体 ${delta.entityId}: 时间线回退到第 ${delta.statusFlagChanges.timeline_progression} 章`)
          }
        }
      }
    }
    if (issues.length === 0) {
      return { check: 'timeline_monotonicity', status: 'pass', detail: '时间线正常' }
    }
    return { check: 'timeline_monotonicity', status: 'fail', detail: issues.join('; ') }
  }

  /**
   * 检查库存一致性 —— 物品不能凭空出现/消失
   */
  private async checkInventoryConsistency(projectId: string, deltas: StateDelta[]): Promise<CheckResult> {
    const issues: string[] = []

    for (const delta of deltas) {
      if (!delta.inventoryAdd && !delta.inventoryRemove) continue

      const currentState = await getEntityState(projectId, delta.entityId)
      if (!currentState) {
        // 首次出现，初始化
        continue
      }

      // 检查移除的物品是否原本拥有
      if (delta.inventoryRemove && delta.inventoryRemove.length > 0) {
        const inventory: string[] = currentState.inventory || []
        for (const item of delta.inventoryRemove) {
          if (!inventory.includes(item)) {
            // 通过 entity_registry 解析物品名
            const itemEntity = await getEntityById(item)
            const itemName = itemEntity?.name || item
            issues.push(`${itemName} 不在 ${delta.entityId} 的库存中，无法移除`)
          }
        }
      }
    }

    if (issues.length === 0) {
      return { check: 'inventory_consistency', status: 'pass', detail: '库存变更合理' }
    }
    return {
      check: 'inventory_consistency',
      status: 'warn',
      detail: issues.join('; '),
    }
  }

  /**
   * 检查关系变更是否与已有设定冲突
   */
  private async checkRelationshipConflicts(projectId: string, deltas: StateDelta[]): Promise<CheckResult> {
    const issues: string[] = []

    for (const delta of deltas) {
      if (!delta.relationshipChanges || delta.relationshipChanges.length === 0) continue
      const currentState = await getEntityState(projectId, delta.entityId)
      if (!currentState) continue

      const rels: Record<string, string> = currentState.relationships || {}
      for (const rc of delta.relationshipChanges) {
        const oldType = rels[rc.targetEntityId]
        if (oldType && oldType === '血亲' && rc.newType === '宿敌') {
          issues.push(`${delta.entityId} 与 ${rc.targetEntityId} 已设定为血亲，不可改为宿敌`)
        }
      }
    }

    if (issues.length === 0) {
      return { check: 'relationship_conflicts', status: 'pass', detail: '关系变更合理' }
    }
    return { check: 'relationship_conflicts', status: 'fail', detail: issues.join('; ') }
  }

  /**
   * 检查禁止的状态转换
   */
  private async checkForbiddenTransitions(projectId: string, deltas: StateDelta[]): Promise<CheckResult> {
    const issues: string[] = []

    for (const delta of deltas) {
      if (!delta.statusFlagChanges) continue

      // 已死不能复生
      if (delta.statusFlagChanges.isAlive === true) {
        const currentState = await getEntityState(projectId, delta.entityId)
        if (currentState?.statusFlags?.isAlive === false) {
          const entity = await getEntityById(delta.entityId)
          const name = entity?.name || delta.entityId
          issues.push(`${name} 已被标记为死亡，不可复生`)
        }
      }
    }

    if (issues.length === 0) {
      return { check: 'forbidden_transitions', status: 'pass', detail: '无禁止状态转换' }
    }
    return { check: 'forbidden_transitions', status: 'fail', detail: issues.join('; ') }
  }

  /**
   * 构建差异报告
   */
  private buildDiffReport(checks: CheckResult[], score: number): string {
    const lines: string[] = []
    lines.push(`一致性校验报告 (Score: ${score}/100)`)
    lines.push('')

    for (const check of checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'
      lines.push(`${icon} ${check.check}`)
      lines.push(`   ${check.detail}`)
    }

    return lines.join('\n')
  }

  /**
   * 快速校验（轻量版——只检查实体存在性和禁止转换）
   * 在 Writer 任务完成前做预检，不等全部 5 项
   */
  async quickVerify(projectId: string, deltas: StateDelta[]): Promise<{ ok: boolean; reason?: string }> {
    for (const delta of deltas) {
      const entity = await getEntityById(delta.entityId)
      if (!entity || entity.projectId !== projectId) {
        return { ok: false, reason: `实体 ${delta.entityId} 未注册` }
      }
      if (delta.statusFlagChanges?.isAlive === true) {
        const state = await getEntityState(projectId, delta.entityId)
        if (state?.statusFlags?.isAlive === false) {
          const name = entity.name
          return { ok: false, reason: `${name} 已死亡不可复生` }
        }
      }
    }
    return { ok: true }
  }

  /**
   * Phase X.3 — Shadow 模式钩子。
   * 在 Writer 双轨输出时被调用，仅记录，不阻断。
   * 每次调用：验证 state_delta，写 log，不触发生成/重写。
   */
  async onShadowDeltaGenerated(
    projectId: string,
    deltas: StateDelta[],
    chapterNo: number,
  ): Promise<{ ok: boolean; warnings: string[] }> {
    const warnings: string[] = []
    let ok = true

    for (const delta of deltas) {
      const entity = await getEntityById(delta.entityId)
      if (!entity || entity.projectId !== projectId) {
        warnings.push(`实体 ${delta.entityId} 未注册`)
        ok = false
        continue
      }
      if (delta.statusFlagChanges?.isAlive === true) {
        const state = await getEntityState(projectId, delta.entityId)
        if (state?.statusFlags?.isAlive === false) {
          warnings.push(`${entity.name}: 已死亡不可复生`)
          ok = false
        }
      }
    }

    if (warnings.length > 0) {
      console.log(`[ConsistencyVerifier/Shadow] ch${chapterNo}: ${warnings.length} warnings, ok=${ok}`)
    } else {
      console.log(`[ConsistencyVerifier/Shadow] ch${chapterNo}: delta clean, ok=true`)
    }

    try {
      await eventLogRepository.create({
        data: {
          entityType: 'chapter',
          entityId: `${projectId}:${chapterNo}`,
          eventType: 'SHADOW_DELTA_VERIFIED',
          payload: { deltas: deltas.length, ok, warnings, source: 'shadow_hook' },
        },
      })
    } catch {
      // 非关键失败
    }

    return { ok, warnings }
  }

  /**
   * 章节文本级一致性校验（Task 4：不依赖 state_delta，直接查正文 vs StoryContext）
   *
   * 规则（确定性，无 LLM 成本）：
   * 1. 死亡角色仍在行动（identity 含死亡/殒命，但正文出现角色行动/对话）
   * 2. 已失去/损坏物品仍在正常使用（items 含失去/丢弃/损坏，但正文出现使用描述）
   *
   * 输出：warnings + score（100 - 每条警告扣 10）+ ok
   */
  async verifyChapterText(
    projectId: string,
    chapterNo: number,
    chapterText: string,
  ): Promise<{ warnings: string[]; score: number; ok: boolean }> {
    const warnings: string[] = []
    const text = chapterText || ''
    if (!text) return { warnings, score: 100, ok: true }

    try {
      const { buildStoryContext } = await import('./story-context-builder.service.js')
      const ctx = await buildStoryContext(projectId, chapterNo)

      // ── 1. 死亡角色仍在行动 ──
      const ACTION_WORDS = /(说|道|怒|笑|冲|杀|走|去|来|看|出手|攻击|战斗|离开|前往|质问|冷笑|点头)/
      for (const char of ctx.characters) {
        const identities = char.currentState.identity || []
        const isDead = identities.some(i => /死亡|殒命|陨落|身亡|战死/.test(i))
        if (!isDead) continue
        const name = char.name
        if (!name || name.length < 2) continue
        // 死亡角色名出现在正文 + 伴随行动/对话词 → 警告
        const nameIdx = text.indexOf(name)
        if (nameIdx >= 0) {
          const around = text.slice(Math.max(0, nameIdx - 30), Math.min(text.length, nameIdx + name.length + 30))
          if (ACTION_WORDS.test(around) && !/回忆|回想|遗像|坟|遗物|梦里|梦中|生前/.test(around)) {
            warnings.push(`⚠️ 角色「${name}」已在第${ctx.currentChapterNo || chapterNo}章前死亡（${identities.join('、')}），但本章正文仍在行动/说话，请核查（除非是回忆/梦境/闪回并明确标注）`)
          }
        }
      }

      // ── 2. 已失去/损坏物品仍在用（直接查 ITEM 状态记录——当前持有列表会过滤失去的物品）──
      try {
        const lostItemStates = await prisma.hdzCharacterState.findMany({
          where: { projectId, stateType: 'ITEM', event: { in: ['失去', '丢弃', '损坏', '被毁', '遗失', '破碎'] } },
        })
        const charNames = new Map(ctx.characters.map(c => [c.id, c.name]))
        for (const s of lostItemStates) {
          const itemName = String(s.description || s.event || '').replace(/（.*?）|\(.*?\)/g, '').trim()
          if (!itemName || itemName.length < 2) continue
          if (!text.includes(itemName)) continue
          const useIdx = text.indexOf(itemName)
          const around = text.slice(Math.max(0, useIdx - 20), Math.min(text.length, useIdx + itemName.length + 20))
          if (!/回忆|想起|曾经|过去|遗物|碎片|残骸/.test(around)) {
            warnings.push(`⚠️ 角色「${charNames.get(s.characterId) || s.characterId}」的物品「${itemName}」已${s.event}（第${s.chapterNo}章），但本章正文仍在使用，请核查`)
          }
        }
      } catch (itemErr: any) {
        console.warn(`[ConsistencyVerifier/Text] 物品校验失败: ${itemErr.message}`)
      }

      // ── 3. 一致性警告（来自 story-context-builder 的规则检测）──
      for (const w of ctx.consistencyWarnings || []) {
        warnings.push(`ℹ️ ${w}`)
      }
    } catch (err: any) {
      console.warn(`[ConsistencyVerifier/Text] ch${chapterNo} 校验失败: ${err.message}`)
    }

    // 去重
    const unique = [...new Set(warnings)]
    const score = Math.max(0, 100 - unique.length * 10)
    console.log(`[ConsistencyVerifier/Text] ch${chapterNo}: warnings=${unique.length}, score=${score}, ok=${unique.length === 0}`)

    try {
      await eventLogRepository.create({
        data: {
          entityType: 'chapter',
          entityId: `${projectId}:${chapterNo}`,
          eventType: 'CHAPTER_TEXT_VERIFIED',
          payload: { warnings: unique, score, source: 'text_verifier' },
        },
      })
    } catch {
      // 非关键失败
    }

    return { warnings: unique, score, ok: unique.length === 0 }
  }

  /**
   * 章节生成前 Context Gate（02-B Task 1）——主动防错：在错误产生前拦截
   *
   * 确定性检查（无 LLM 成本）：
   * G1 章节合法性 —— 章节号 >= 1、不重复生成（已有正文且非 rewrite）
   * G2 前置审批门 —— 前置章未审核 → warn；前置章审核发现 critical/major 问题 → FAIL（已知错误不传播）
   * G3 上下文可构建 —— buildStoryContext 成功且有最小数据（角色/世界观），否则 FAIL（先规划再写）
   * G4 时间线单调 —— 不跳章（目标章节 <= 最大章节+1），否则 warn
   *
   * 输出：gates[] + score（100 - fail*25 - warn*5）+ ok
   */
  async verifyBeforeGeneration(
    projectId: string,
    chapterNo: number,
    opts?: { isRewrite?: boolean },
  ): Promise<{ ok: boolean; score: number; gates: CheckResult[]; warnings: string[] }> {
    const gates: CheckResult[] = []
    const warnings: string[] = []
    let score = 100

    // ── G1 章节合法性 ──
    if (!Number.isInteger(chapterNo) || chapterNo < 1) {
      gates.push({ check: '章节合法性', status: 'fail', detail: `章节号非法: ${chapterNo}` })
      score -= 25
    } else {
      const existing = await prisma.hdzChapter.findFirst({ where: { projectId, chapterNo } })
      if (existing?.content && !opts?.isRewrite) {
        gates.push({ check: '章节合法性', status: 'fail', detail: `第${chapterNo}章已有正文（${existing.wordCount || 0}字），非 rewrite 模式禁止覆盖` })
        score -= 25
      } else {
        gates.push({ check: '章节合法性', status: 'pass', detail: `第${chapterNo}章可生成` })
      }
    }

    // ── G2 前置审批门 ──
    const prevNo = chapterNo - 1
    if (prevNo >= 1) {
      const prev = await prisma.hdzChapter.findFirst({ where: { projectId, chapterNo: prevNo } })
      if (prev) {
        const prevNotes: any[] = (prev.reviewNotes as any[]) || []
        const hasCritical = prevNotes.some(n => ['critical', 'major'].includes((n.severity || '').toLowerCase()))
        if (prev.status !== 'reviewed' && prev.status !== 'final') {
          if (hasCritical) {
            gates.push({ check: '前置审批门', status: 'fail', detail: `第${prevNo}章审核存在 ${prevNotes.filter(n => ['critical','major'].includes((n.severity||'').toLowerCase())).length} 条 critical/major 问题且未通过审批，禁止继续生成（错误不传播）` })
            score -= 25
          } else {
            gates.push({ check: '前置审批门', status: 'warn', detail: `第${prevNo}章状态=${prev.status} 尚未审核通过，继续生成可能放大未审问题` })
            score -= 5
          }
        } else {
          gates.push({ check: '前置审批门', status: 'pass', detail: `第${prevNo}章已审核通过` })
        }
      } else {
        gates.push({ check: '前置审批门', status: 'warn', detail: `第${prevNo}章不存在（跳章或章节未创建）` })
        score -= 5
      }
    } else {
      gates.push({ check: '前置审批门', status: 'pass', detail: '第一章无前置' })
    }

    // ── G3 上下文可构建 ──
    try {
      const { buildStoryContext } = await import('./story-context-builder.service.js')
      const ctx = await buildStoryContext(projectId, chapterNo)
      if (!ctx.characters || ctx.characters.length === 0) {
        gates.push({ check: '上下文完整性', status: 'fail', detail: 'StoryContext 无角色数据——先生成总纲/角色设定再写正文' })
        score -= 25
      } else if (!ctx.worldState || Object.keys(ctx.worldState).length === 0) {
        gates.push({ check: '上下文完整性', status: 'warn', detail: 'StoryContext 世界状态为空，生成可能缺乏背景约束' })
        score -= 5
      } else {
        gates.push({ check: '上下文完整性', status: 'pass', detail: `StoryContext 就绪（角色 ${ctx.characters.length} 个，世界状态 ${Object.keys(ctx.worldState).length} 项）` })
      }
    } catch (err: any) {
      gates.push({ check: '上下文完整性', status: 'fail', detail: `StoryContext 构建失败: ${err.message}` })
      score -= 25
    }

    // ── G4 时间线单调 ──
    const maxRow = await prisma.hdzChapter.aggregate({ where: { projectId }, _max: { chapterNo: true } })
    const maxNo = maxRow._max.chapterNo ?? 0
    if (chapterNo > maxNo + 1) {
      gates.push({ check: '时间线单调', status: 'warn', detail: `目标第${chapterNo}章，但最大已到第${maxNo}章——跳章生成，请确认章节大纲` })
      score -= 5
    } else {
      gates.push({ check: '时间线单调', status: 'pass', detail: `时间线连续（最大第${maxNo}章）` })
    }

    const ok = score >= 70 && !gates.some(g => g.status === 'fail')
    for (const g of gates) if (g.status !== 'pass') warnings.push(`[${g.check}] ${g.detail}`)

    console.log(`[ConsistencyVerifier/Gate] ch${chapterNo}: score=${score}, ok=${ok}, gates=${gates.map(g => g.status).join('/')}`)

    try {
      await eventLogRepository.create({
        data: {
          entityType: 'chapter',
          entityId: `${projectId}:${chapterNo}`,
          eventType: 'PRE_GENERATION_GATE',
          payload: { score, ok, gates, source: 'context_gate' },
        },
      })
    } catch {
      // 非关键失败
    }

    return { ok, score, gates, warnings }
  }
}

export const consistencyVerifier = new ConsistencyVerifier()
