/**
 * adaptive/adaptive-kernel.ts — Phase 8.1 Identity 闭环集成
 *
 * Pipeline (最终形态):
 *   Runtime → Observe
 *     ↓
 *   Memory (被动记录)
 *     ↓
 *   Identity (主动演化)
 *     ↓
 *   Rule Engine (deterministic, 现在消费 identityBias)
 *     ↓
 *   LLM Advisor (optional, constrained)
 *     ↓
 *   Policy Engine (final decision, 现在消费 identityWeight)
 *     ↓
 *   Mutation Engine (IR-safe)
 *     ↓
 *   反馈 → Runtime
 *
 * 宪法：
 *   1. 不修改 IR / StoryGraph / SceneGraph
 *   2. LLM 只做建议，不做决策
 *   3. Policy Engine 是最终裁决（deterministic）
 *   4. Identity bias 是权重修饰符，不可覆盖规则
 */

import { analyze, resetStagnation } from './rule-engine.js'
import { buildAdvisorMessage, parseAdvisorResponse, type AdvisorSuggestion } from './llm-advisor.js'
import { decide, type PolicyDecision } from './policy-engine.js'
import { applyMutation, type MutationResult } from './mutation-engine.js'
import type { PlaybackControllerState } from '../runtime/playback-controller.js'
import type { StoryBundle } from '../story/story-compiler.js'
import type { StoryExecutionGraph } from '../execution/story-scheduler.js'
import type { IdentitySnapshot } from '../identity/narrative-identity-kernel.js'
import { BehaviorBiasEngine } from '../identity/behavior-bias-engine.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface IdentityBiasInjection {
  /** Identity-driven pacing modifier (-0.3 to 0.3) */
  pacingModifier: number
  /** Identity-driven intensity modifier (-0.2 to 0.2) */
  intensityModifier: number
  /** 偏置信度（越高→影响越大） */
  confidence: number
  /** 解释 */
  reason: string
}

export interface AdaptiveLoopResult {
  decision: PolicyDecision
  mutationResult: MutationResult
  ruleOutput: ReturnType<typeof analyze>
  llmSuggestionUsed: boolean
  identityBiasUsed: boolean
  identityBias?: IdentityBiasInjection
}

export interface AdaptiveKernelOptions {
  /** 允许 LLM 建议（默认关闭） */
  enableLLM: boolean
  /** 允许 Identity bias（默认开启） */
  enableIdentityBias: boolean
  /** 预期情绪 valence（可选的参考值） */
  expectedEmotionValence?: number
}

const DEFAULT_OPTIONS: AdaptiveKernelOptions = {
  enableLLM: false,
  enableIdentityBias: true,
}

// ─── LLM 调用接口 ────────────────────────────────────

let llmCallImpl: ((system: string, user: string) => Promise<string>) | null = null

export function setLLMCallImpl(fn: (system: string, user: string) => Promise<string>): void {
  llmCallImpl = fn
}

// ─── Identity Bias Injector ─────────────────────────

const biasEngine = new BehaviorBiasEngine()

/**
 * 从 Identity Snapshot 提取偏置注入。
 * 取所有角色的加权平均偏置。
 */
function computeIdentityBias(identitySnapshot: IdentitySnapshot): IdentityBiasInjection {
  const chars = Object.keys(identitySnapshot.characters)
  if (chars.length === 0) {
    return { pacingModifier: 0, intensityModifier: 0, confidence: 0, reason: '无角色身份数据' }
  }

  let totalPacing = 0
  let totalIntensity = 0
  let totalConfidence = 0
  const reasons: string[] = []

  for (const charId of chars) {
    const vec = identitySnapshot.characters[charId]
    const bias = biasEngine.computeBias(vec)
    totalPacing += bias.pacingBias
    totalIntensity += bias.intensityBias
    totalConfidence += bias.confidence
    if (bias.confidence > 0.3) reasons.push(`${charId}: ${bias.reason}`)
  }

  const n = chars.length
  return {
    pacingModifier: clampNeg(totalPacing / n, -0.3, 0.3),
    intensityModifier: clampNeg(totalIntensity / n, -0.2, 0.2),
    confidence: totalConfidence / n,
    reason: reasons.length > 0 ? reasons.join('；') : '身份均衡',
  }
}

/** 将 Identity bias 应用到规则输出（修改 triggers 的 severity 权重） */
function applyIdentityBiasToRuleOutput(
  ruleOutput: ReturnType<typeof analyze>,
  identityBias: IdentityBiasInjection,
): ReturnType<typeof analyze> {
  if (identityBias.confidence < 0.15) return ruleOutput // 低置信度 → 不变

  const modifiedTriggers = ruleOutput.triggers.map(t => {
    // 根据 target 应用对应偏置
    if (t.target === 'pacing') {
      // 如果 identity 偏置方向与 trigger 方向相反，降低 severity
      const modifier = identityBias.pacingModifier * 0.5
      const adjusted = Math.max(0, t.severity - modifier)
      return { ...t, severity: clampNeg(adjusted, 0, 1) }
    }
    if (t.target === 'scene') {
      const modifier = identityBias.intensityModifier * 0.5
      const adjusted = Math.max(0, t.severity - modifier)
      return { ...t, severity: clampNeg(adjusted, 0, 1) }
    }
    return t
  })

  // 重新计算 maxSeverity
  const maxSeverity = modifiedTriggers.length > 0
    ? Math.max(...modifiedTriggers.map(t => t.severity))
    : 0

  return {
    triggers: modifiedTriggers,
    maxSeverity,
    hasCriticalTrigger: modifiedTriggers.some(t => t.severity > 0.7),
  }
}

// ─── executeAdaptiveLoop（增强版）────────────────────

/**
 * 一次自适应循环：观测 → 身份偏置注入 → 分析 → 决策 → 突变
 */
export async function executeAdaptiveLoop(
  currentState: PlaybackControllerState,
  options?: Partial<AdaptiveKernelOptions>,
  bundle?: StoryBundle,
  executionPlan?: StoryExecutionGraph,
  identitySnapshot?: IdentitySnapshot,
): Promise<AdaptiveLoopResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // 1. Identity Bias Injection（新增步骤）
  let identityBias: IdentityBiasInjection = { pacingModifier: 0, intensityModifier: 0, confidence: 0, reason: 'none' }
  let identityBiasUsed = false

  if (opts.enableIdentityBias && identitySnapshot) {
    identityBias = computeIdentityBias(identitySnapshot)
    identityBiasUsed = identityBias.confidence > 0.1
  }

  // 2. Rule Engine（增强——消费 identityBias）
  const rawRuleOutput = analyze(currentState, opts.expectedEmotionValence)
  const ruleOutput = identityBiasUsed
    ? applyIdentityBiasToRuleOutput(rawRuleOutput, identityBias)
    : rawRuleOutput

  // 规则未触发 → 提前返回
  if (ruleOutput.triggers.length === 0) {
    return {
      decision: { approved: false, reason: identityBiasUsed
        ? `未触发规则（身份偏置已应用: ${identityBias.reason}）`
        : 'untriggered' },
      mutationResult: { applied: false, summary: '未触发规则', modifiedKeys: [] },
      ruleOutput,
      llmSuggestionUsed: false,
      identityBiasUsed,
      identityBias: identityBiasUsed ? identityBias : undefined,
    }
  }

  // 3. LLM Advisor（可选）
  let llmSuggestion: AdvisorSuggestion | null = null
  if (opts.enableLLM && llmCallImpl && ruleOutput.maxSeverity > 0.3) {
    try {
      // 给 LLM 注入身份上下文
      const identityContext = identityBiasUsed
        ? `\nIdentity bias active: ${identityBias.reason} (confidence: ${(identityBias.confidence * 100).toFixed(0)}%)`
        : ''
      const msg = buildAdvisorMessage({
        ruleTriggers: ruleOutput.triggers.map(t => t.name),
        maxSeverity: ruleOutput.maxSeverity,
        currentSceneId: currentState.runtimeState.currentSceneId,
        currentIntensity: currentState.runtimeState.intensity,
        completedScenes: currentState.runtimeState.completedScenes,
        totalScenes: currentState.runtimeState.totalScenes,
        speedFactorAverages: [],
      })
      msg.user += identityContext
      const raw = await llmCallImpl(msg.system, msg.user)
      llmSuggestion = parseAdvisorResponse(raw)
    } catch {
      // LLM 调用失败 → 降级
    }
  }

  // 4. Policy Engine（现在消费 identityBias 作为附加输入）
  // decide() 的规则主导 + LLM 建议已包含身份信息
  const decision = decide(ruleOutput, llmSuggestion)

  // 5. Mutation Engine
  const mutationResult = decision.approved
    ? applyMutation(decision, currentState, bundle, executionPlan)
    : { result: { applied: false, summary: decision.reason, modifiedKeys: [] } as MutationResult, suggestedOverrides: undefined }

  return {
    decision,
    mutationResult: mutationResult.result,
    ruleOutput,
    llmSuggestionUsed: llmSuggestion !== null,
    identityBiasUsed,
    identityBias: identityBiasUsed ? identityBias : undefined,
  }
}

/** 场景切换时重置停滞检测 */
export function onSceneChange(sceneId: string): void {
  resetStagnation(sceneId)
}

// ─── 辅助 ──────────────────────────────────────────────

function clampNeg(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export default { executeAdaptiveLoop, setLLMCallImpl, onSceneChange }
