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

import { prisma } from '../../utils/index.js'
import { getWorldState, getEntityState, type StateDelta, type EntityState } from './world-state.service.js'
import { getEntityById } from './entity-registry.service.js'
import { emitEvent } from './event-log.service.js'

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
      await prisma.eventLog.create({
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
      await prisma.eventLog.create({
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
}

export const consistencyVerifier = new ConsistencyVerifier()
