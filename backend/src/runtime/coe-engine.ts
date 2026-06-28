/**
 * COE — Cinematic Optimization Engine（主入口）
 *
 * 四层：Resolve → Plan → Generate → Validate
 */

import type { CoeEngine, CoeOptions, OptimizationResult, PatchPlan, PatchSection, PatchConflict, PatchValidation, PatchType, FieldPatch } from './coe-types.js'
import type { CapabilityReport, Recommendation } from './cee-types.js'
import { ScalePatchStrategy, LightingLockPatchStrategy, RegenPatchStrategy, CompositionPatchStrategy, FocusPatchStrategy, MotionPatchStrategy } from './coe-strategies.js'

// ─── Layer 1: Recommendation Resolver ─────

export class RecommendationResolver {
  private strategies = new Map<string, import('./coe-strategies.js').PatchStrategy[]>()

  constructor() {
    this.register(new ScalePatchStrategy())
    this.register(new LightingLockPatchStrategy())
    this.register(new RegenPatchStrategy())
    this.register(new CompositionPatchStrategy())
    this.register(new FocusPatchStrategy())
    this.register(new MotionPatchStrategy())
  }

  register(strategy: import('./coe-strategies.js').PatchStrategy): void {
    for (const type of strategy.handlesTypes) {
      if (!this.strategies.has(type)) this.strategies.set(type, [])
      this.strategies.get(type)!.push(strategy)
    }
  }

  /** Resolve: Recommendation → PatchSection[] */
  resolve(recommendations: Recommendation[]): PatchSection[] {
    const sections: PatchSection[] = []
    for (const rec of recommendations) {
      const type = rec.type
      const strategies = this.strategies.get(type)
      if (!strategies) continue
      for (const s of strategies) {
        sections.push(...s.generate(rec))
      }
    }
    return sections
  }
}

// ─── Layer 2: Patch Planner ───────────────

export class PatchPlanner {
  /** 冲突检测：同一路径被修改为不同值 */
  detectConflicts(sections: PatchSection[]): PatchConflict[] {
    const conflicts: PatchConflict[] = []
    const pathMap = new Map<string, Array<{ value: string | number | boolean; cap: string }>>()

    for (const s of sections) {
      for (const f of s.fields) {
        if (!pathMap.has(f.path)) pathMap.set(f.path, [])
        pathMap.get(f.path)!.push({ value: f.to, cap: s.targetCapability })
      }
    }

    for (const [path, values] of pathMap.entries()) {
      const uniqueValues = new Set(values.map(v => String(v.value)))
      if (uniqueValues.size > 1) {
        const caps = [...new Set(values.map(v => v.cap))]
        conflicts.push({
          path,
          betweenCapabilities: caps,
          description: `Path "${path}" has conflicting values: ${[...uniqueValues].join(' vs ')} (from capabilities: ${caps.join(', ')})`,
        })
      }
    }

    return conflicts
  }

  /** 优先级排序：safe > recommended > experimental */
  prioritize(sections: PatchSection[]): PatchSection[] {
    const order: Record<PatchType, number> = { safe: 0, recommended: 1, experimental: 2 }
    return [...sections].sort((a, b) => order[a.type] - order[b.type])
  }

  /** 解决冲突：safe 覆盖；相同时取 high confidence */
  resolveConflicts(sections: PatchSection[], conflicts: PatchConflict[]): PatchSection[] {
    if (conflicts.length === 0) return sections

    const conflictPaths = new Set(conflicts.map(c => c.path))

    // 按 path 分组，保留优先级最高的
    const grouped = new Map<string, PatchSection[]>()
    for (const s of sections) {
      const hasConflictField = s.fields.some(f => conflictPaths.has(f.path))
      if (hasConflictField) {
        const key = s.fields.map(f => f.path).join('|')
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(s)
      }
    }

    // 对冲突组进行裁决
    const resolvedPaths = new Set<string>()
    const filtered: PatchSection[] = []

    for (const s of sections) {
      const hasConflict = s.fields.some(f => conflictPaths.has(f.path))
      if (!hasConflict) {
        filtered.push(s)
        continue
      }

      const key = s.fields.map(f => f.path).join('|')
      if (resolvedPaths.has(key)) continue
      resolvedPaths.add(key)

      const group = grouped.get(key) || []
      // 选择 safe 类型中最高的 confidence；没有 safe 选 recommended
      const order: PatchType[] = ['safe', 'recommended', 'experimental']
      let best: PatchSection | null = null
      for (const t of order) {
        const candidates = group.filter(g => g.type === t)
        if (candidates.length > 0) {
          best = candidates.reduce((a, b) => a.confidence >= b.confidence ? a : b)
          break
        }
      }
      if (best) filtered.push(best)
    }

    return filtered
  }

  plan(sections: PatchSection[]): PatchPlan {
    const conflicts = this.detectConflicts(sections)
    const prioritized = this.prioritize(sections)
    const resolved = this.resolveConflicts(prioritized, conflicts)

    const applyOrder = resolved.map((_, i) => `patch_${i}`)

    return {
      id: `plan_${Date.now()}`,
      patches: resolved,
      conflicts,
      applyOrder,
      generatedAt: new Date().toISOString(),
    }
  }
}

// ─── Layer 4: Patch Validator ─────────────

export class PatchValidator {
  validate(plan: PatchPlan): PatchValidation {
    const errors: string[] = []
    const warnings: string[] = []
    const affected: PatchValidation['affectedCapabilities'] = []

    // Validate 1: Patch 不能为空
    for (const p of plan.patches) {
      if (p.fields.length === 0) {
        warnings.push(`Empty patch for ${p.targetCapability}: no fields specified`)
      }
    }

    // Validate 2: 冲突检测
    if (plan.conflicts.length > 0) {
      for (const c of plan.conflicts) {
        errors.push(`Conflict on ${c.path}: ${c.description}`)
      }
    }

    // Validate 3: 副作用分析
    const safeCount = plan.patches.filter(p => p.type === 'safe').length
    const expCount = plan.patches.filter(p => p.type === 'experimental').length
    if (expCount > safeCount) {
      warnings.push(`Experimental patches (${expCount}) outnumber safe patches (${safeCount})`)
    }

    // 副作用估算
    const allCaps = new Set(plan.patches.map(p => p.targetCapability))
    for (const cap of allCaps) {
      const capsForThis = plan.patches.filter(p => p.targetCapability === cap)
      const avgConf = capsForThis.reduce((s, p) => s + p.confidence, 0) / capsForThis.length
      affected.push({
        capability: cap,
        expectedChange: Math.round(avgConf * 10 + 5),
        direction: avgConf >= 0.7 ? 'up' : 'down',
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      affectedCapabilities: affected,
    }
  }
}

// ─── COE Engine ────────────────────────────

export class CinematicOptimizationEngine implements CoeEngine {
  private resolver = new RecommendationResolver()
  private planner = new PatchPlanner()
  private validator = new PatchValidator()

  /** 设置自定义策略 */
  registerStrategy(strategy: import('./coe-strategies.js').PatchStrategy): void {
    this.resolver.register(strategy)
  }

  optimize(reports: CapabilityReport[], options?: CoeOptions): OptimizationResult {
    const videoId = reports.length > 0 ? `vid_${Date.now()}` : 'unknown'
    const evidenceId = `ev_${Date.now()}`
    const minConfidence = options?.minConfidence ?? 0
    const maxPatches = options?.maxPatches ?? 10

    // Layer 1: Resolve Recommendations
    const allRecs = reports.flatMap(r => r.recommendations)
    const rawSections = this.resolver.resolve(allRecs)

    // 过滤低置信度
    const filteredSections = rawSections.filter(s => s.confidence >= minConfidence)

    // Layer 2: Plan
    const plan = this.planner.plan(filteredSections)

    // 限制最大 patch 数
    if (plan.patches.length > maxPatches) {
      plan.patches = plan.patches.slice(0, maxPatches)
    }

    // Layer 3: 已经是 Patch 格式（直接从策略生成）

    // Layer 4: Validate
    const validation = this.validator.validate(plan)

    // Summary
    const total = plan.patches.length
    const safeCount = plan.patches.filter(p => p.type === 'safe').length
    const recCount = plan.patches.filter(p => p.type === 'recommended').length
    const expCount = plan.patches.filter(p => p.type === 'experimental').length
    const overallConf = total > 0
      ? parseFloat((plan.patches.reduce((s, p) => s + p.confidence, 0) / total).toFixed(2))
      : 1

    return {
      videoId,
      evidenceId,
      generatedAt: new Date().toISOString(),
      plan,
      patches: plan.patches,
      validation,
      summary: {
        totalPatches: total,
        safePatches: safeCount,
        recommendedPatches: recCount,
        experimentalPatches: expCount,
        overallConfidence: overallConf,
        autoApplicable: validation.valid && total > 0 && expCount === 0,
      },
    }
  }
}
