/**
 * director-runtime/core.ts
 *
 * ⚔️ Phase 3.5 — Director Runtime Core（发散 → 收敛 → 编译）
 *
 * Phase 3:  多样性（发散）
 * Phase 3.5: 收敛（确保 Blueprint 单输入）
 *
 * 完整流程：
 *   1. IntentExpander — 语义扩展
 *   2. StoryVariation — 生成 2-3 个变体（发散）
 *   3. ConvergenceEngine — 评分 + 选择（收敛）
 *   4. buildNarrativeGraph — 事件因果网络
 *   5. compile — 编译为 Blueprint（单输入）
 *
 * 宪法规则（不变）：
 *   ❌ 不碰 Blueprint
 *   ❌ 不碰 Execution Spine
 *   ❌ 不碰 Compiler
 *   ✔ 只影响 DirectorPlan + NarrativeGraph
 */

import type { DirectorInput, DirectorPlan, DirectorRuntime } from './types.js'
import { generateDirectorPlan } from './plan-generator.js'
import { buildNarrativeGraph } from './narrative-graph.js'
import { compileBlueprint } from './director-to-blueprint-compiler.js'
import { validateDirectorPlan, validateBlueprintCleanliness } from './validator.js'
import { expandIntent } from '../director-intelligence/intent-expander.js'
import { generateVariants } from '../director-intelligence/story-variation.js'
import { convergePlans } from '../director-intelligence/convergence-engine.js'

// ── 日志工具 ──

const LOG_TAG = '[DIRECTOR_RUNTIME]'

function logEvent(event: string, data?: Record<string, unknown>) {
  const msg = data
    ? `${LOG_TAG} ${event} ${JSON.stringify(data)}`
    : `${LOG_TAG} ${event}`
  console.log(msg)
}

// ── Core Engine（Phase 3.5 升级） ──

export const directorRuntime: DirectorRuntime = {
  /**
   * analyze — User Input → 收敛后的 DirectorPlan + NarrativeGraph
   *
   * Phase 3.5 完整流程：
   *   1. IntentExpander — 语义扩展
   *   2. generateDirectorPlan — 基础 plan
   *   3. generateVariants — 生成变体（发散）
   *   4. convergePlans — 评分 + 选择（收敛）
   *   5. buildNarrativeGraph — 事件因果网络
   *
   * 返回：收敛后的单一 DirectorPlan
   */
  async analyze(input: DirectorInput): Promise<DirectorPlan> {
    logEvent('DIRECTOR_PLAN_CREATED', {
      inputIntent: input.userIntent.substring(0, 60),
      constraintsPresent: !!input.constraints,
      refPresent: !!input.referenceMaterial,
    })

    // Step 1: Intent Expansion
    const expansion = expandIntent(input.userIntent)
    logEvent('INTENT_EXPANDED', {
      expansions: expansion.meta.expansions.length,
      moodTags: expansion.moodTags,
      strategies: expansion.meta.appliedStrategies,
    })

    // Step 2: 基础 plan
    const enhancedInput: DirectorInput = {
      ...input,
      userIntent: expansion.enhancedIntent,
    }
    const basePlan = generateDirectorPlan(enhancedInput)

    // Step 3: 生成变体（发散）
    const variants = generateVariants(basePlan, { count: 3 })
    logEvent('DIRECTOR_VARIANTS_GENERATED', {
      variantCount: variants.length,
      strategies: ['emotional_shift', 'pacing_shift', 'focus_shift'],
    })

    // Step 4: 收敛（评分 + 选择）
    const convergence = convergePlans([basePlan, ...variants])
    logEvent('DIRECTOR_PLAN_CONVERGED', {
      candidateCount: convergence.candidates.length,
      selectedScore: convergence.candidates[0].score.total,
      runnerUpScore: convergence.candidates.length > 1 ? convergence.candidates[1].score.total : null,
    })

    const convergedPlan = convergence.selected
    logEvent('DIRECTOR_FINAL_PLAN_SELECTED', {
      ranking: convergence.candidates[0].ranking,
      sceneCount: convergedPlan.sceneSegmentation.length,
      pacing: convergedPlan.narrativeConstraints?.pacing,
    })

    // Step 5: 构建 NarrativeGraph
    const graph = buildNarrativeGraph(convergedPlan)
    convergedPlan.narrativeGraph = graph

    // 添加 meta
    convergedPlan.meta = {
      timestamp: Date.now(),
      inputSource: input.referenceMaterial?.storyText ? 'story_analysis' : 'user_text',
      version: '3.5',
    }

    logEvent('DIRECTOR_PLAN_CREATED', {
      sceneCount: convergedPlan.sceneSegmentation.length,
      graphNodeCount: graph.nodes.length,
      graphEdgeCount: graph.edges.length,
      pacing: convergedPlan.narrativeConstraints?.pacing ?? 'normal',
      intentExpanded: expansion.meta.expansions.length,
      convergedFrom: variants.length + 1,
    })

    // 验证输出合规性
    const validation = validateDirectorPlan(convergedPlan)
    if (!validation.valid) {
      for (const v of validation.violations) {
        console.error(`[DIRECTOR_VIOLATION] ${v.type}: ${v.message}`)
      }
      throw new Error(`[DIRECTOR_VIOLATION] DirectorPlan 验证失败: ${validation.violations.map(v => v.message).join('; ')}`)
    }

    logEvent('DIRECTOR_PLAN_VALIDATED', { violations: validation.violations.length })

    return convergedPlan
  },

  /**
   * compile — DirectorPlan → VideoBlueprint
   *
   * 不变：纯结构映射，验证 Blueprint 清洁度。
   * Phase 3.5 保证：这里永远只收到 1 个 plan（收敛后）。
   */
  async compile(plan: DirectorPlan): Promise<Record<string, unknown>> {
    logEvent('DIRECTOR_COMPILE_START', {
      sceneCount: plan.sceneSegmentation.length,
      narrativeLogicPresent: !!plan.narrativeLogic,
    })

    const blueprint = compileBlueprint(plan, plan.narrativeGraph)

    logEvent('BLUEPRINT_COMPILED_FROM_DIRECTOR', {
      compiledPromptLength: (blueprint.compiledPrompt ?? '').length,
      shotGraphShots: blueprint.shotGraph?.shots?.length ?? 0,
      effectSpecsCount: blueprint.effectSpecs?.length ?? 0,
      promptSource: blueprint.promptSource ?? 'legacy',
    })

    const cleanliness = validateBlueprintCleanliness(blueprint)
    if (!cleanliness.valid) {
      for (const v of cleanliness.violations) {
        console.error(`[BLUEPRINT_CONTAMINATION] ${v.type}: ${v.message}`)
      }
      throw new Error(`[BLUEPRINT_CONTAMINATION] Blueprint 包含叙事残留: ${cleanliness.violations.map(v => v.message).join('; ')}`)
    }

    logEvent('BLUEPRINT_COMPILED_CLEAN', { valid: true })

    return blueprint as Record<string, unknown>
  },

  /**
   * getVariants — 获取叙事变体（收敛前预览）
   *
   * 仅用于调试/预览场景。
   * 生产路径走 analyze() → 内部自动收敛。
   */
  async getVariants(plan: DirectorPlan, count?: number): Promise<DirectorPlan[]> {
    logEvent('STORY_VARIANTS_GENERATED', { baseSceneCount: plan.sceneSegmentation.length, count: count ?? 2 })

    const variants = generateVariants(plan, { count: count ?? 2 })

    const validVariants: DirectorPlan[] = []
    for (const variant of variants) {
      const validation = validateDirectorPlan(variant)
      if (validation.valid) {
        validVariants.push(variant)
      } else {
        console.warn(`[DIRECTOR_VARIANT_SKIPPED] 变体验证失败: ${validation.violations.map(v => v.message).join('; ')}`)
      }
    }

    logEvent('STORY_VARIANTS_GENERATED', {
      requested: count ?? 2,
      valid: validVariants.length,
    })

    return validVariants
  },
}

export { logEvent as logDirectorEvent }
