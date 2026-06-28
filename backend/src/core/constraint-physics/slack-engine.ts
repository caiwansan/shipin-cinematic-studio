/**
 * Creative Slack Engine v1 (v3.7)
 *
 * 将 constraint physics 残留自由度转化为可控的生成扰动。
 *
 * 核心原则：
 * - 不修改 hard 约束（identity / safety）
 * - 不解算冲突（Physics Engine 已做完）
 * - 只分配约束残差空间到 soft / soft_hard 领域的微小偏移
 *
 * 三个模块：
 * 1. SlackAnalyzer — 从 resolvedConstraintField 计算可扰动维度
 * 2. SlackAllocator — 按优先级分配 slack 到各维度
 * 3. PerturbationInjector — 将扰动注入 Agent Layer 输出
 */

import type { ResolvedConstraintField, SlackAllocationOutput } from './types.js'

// ============================================================
// 类型
// ============================================================

/** 可扰动维度 */
export interface SlackDimension {
  name: string
  budget: number           // 此维度可用的 slack 量
  affectedAgents: string[] // 受影响的 Agent（shot / atmosphere / rhythm）
  injectionPoint: string   // 注入点描述
}

/** 维度扰动规则 */
export interface PerturbationRule {
  dimension: string
  maxDelta: number               // 最大偏移量
  injection: (value: number, delta: number) => number  // 扰动函数
}

/** 单镜头扰动 */
export interface ShotPerturbation {
  shotId: string
  cameraDrift: number            // 0.0-1.0 运镜偏移量
  timingShift: number            // -1.0-1.0 节奏偏移
  compositionDrift: number       // 0.0-1.0 构图偏移
  emotionalIntensity: number     // -1.0-1.0 情绪强度偏移
}

/** 松弛层输出 */
export interface SlackEngineOutput {
  shotPerturbations: ShotPerturbation[]
  slackConsumed: number
  slackRemaining: number
  report: {
    dimensions: SlackDimension[]
    consumptionBreakdown: Record<string, number>
    safetyClamps: number         // 被 Clamp 拦截的越界数
  }
}

/** 松弛层输入 */
export interface SlackEngineInput {
  resolvedField: ResolvedConstraintField
  slackAllocation: SlackAllocationOutput
  shotCount: number
}

// ============================================================
// 1. SlackAnalyzer
// ============================================================

/**
 * 从 resolvedConstraintField 计算可扰动维度
 *
 * 规则：
 * - hard 约束 → budget = 0（不可扰动）
 * - soft_hard 约束 → budget = resolved 与 1.0 的差 × 0.3（适度扰动）
 * - soft 约束 → budget = resolved 与 1.0 的差 × 0.7（大幅扰动）
 */
export function analyzeSlackDimensions(
  resolvedField: ResolvedConstraintField,
  slackAllocMap: SlackAllocationOutput,
): SlackDimension[] {
  const dimensions: SlackDimension[] = []

  const DIMENSION_CONFIG: Record<string, { affectedAgents: string[]; injectionPoint: string }> = {
    visualConsistency: {
      affectedAgents: ['shot', 'atmosphere'],
      injectionPoint: 'shot.compiledPrompt.visualStyle',
    },
    characterIdentity: {
      affectedAgents: [],
      injectionPoint: 'none（hard — 不可扰动）',
    },
    cameraFreedom: {
      affectedAgents: ['shot'],
      injectionPoint: 'shot.cameraMotion',
    },
    temporalFlexibility: {
      affectedAgents: ['rhythm'],
      injectionPoint: 'rhythm.beat.adjustedDuration',
    },
    colorPaletteFidelity: {
      affectedAgents: ['atmosphere', 'shot'],
      injectionPoint: 'atmosphere.colorPalette',
    },
  }

  // 先加入 slack 分配（准确反映物理引擎分配）
  const allocated = new Map(slackAllocMap.allocations.map(a => [a.target, a.allocatedSlack]))

  for (const [key, val] of Object.entries(resolvedField)) {
    const config = DIMENSION_CONFIG[key]
    const residual = 1.0 - val.resolved
    if (residual <= 0) continue

    // 分配 slack = 物理引擎分配或按 mode 自动计算
    let budget = allocated.get(key) ?? (
      val.mode === 'hard' ? 0 :
      val.mode === 'soft_hard' ? residual * 0.3 :
      residual * 0.7
    )

    // 预算上限 0.2（防止过度扰动）
    budget = Math.min(budget, 0.2)

    if (budget > 0.01) {
      dimensions.push({
        name: key,
        budget: Math.round(budget * 100) / 100,
        affectedAgents: config?.affectedAgents ?? [],
        injectionPoint: config?.injectionPoint ?? 'unknown',
      })
    }
  }

  return dimensions
}

// ============================================================
// 2. PerturbationInjector
// ============================================================

/**
 * 为每个镜头生成扰动
 *
 * 规则：
 * - 根据各维度 budget 生成 [-maxDelta, +maxDelta] 范围内的偏移
 * - cameraDrift / compositionDrift 只正不負（只增加自由度不减）
 * - timingShift / emotionalIntensity 可为负
 * - hard 约束相关维度跳过
 */
export function generateShotPerturbations(
  dimensions: SlackDimension[],
  shotCount: number,
  seed?: number,
): ShotPerturbation[] {
  if (shotCount <= 0) return []

  // Simple deterministic pseudo-random based on seed
  const random = (offset: number): number => {
    const x = Math.sin((seed ?? 42) + offset * 9973) * 10000
    return x - Math.floor(x)
  }

  const cameraBudget = dimensions.find(d => d.name === 'cameraFreedom')?.budget ?? 0
  const timingBudget = dimensions.find(d => d.name === 'temporalFlexibility')?.budget ?? 0
  const compositionBudget = dimensions.find(d => d.name === 'colorPaletteFidelity')?.budget ?? 0

  const totalBudget = cameraBudget + timingBudget + compositionBudget

  return Array.from({ length: shotCount }, (_, i) => {
    // 在每个镜头上消耗预算的比例逐渐降低（开场扰动更多）
    const decayFactor = 1 - (i / Math.max(shotCount - 1, 1)) * 0.4

    const cameraDrift = cameraBudget > 0
      ? Math.round(random(i * 3 + 0) * cameraBudget * decayFactor * 100) / 100
      : 0

    const timingShift = timingBudget > 0
      ? Math.round((random(i * 3 + 1) * 2 - 1) * timingBudget * decayFactor * 100) / 100
      : 0

    const compositionDrift = compositionBudget > 0
      ? Math.round(random(i * 3 + 2) * compositionBudget * decayFactor * 100) / 100
      : 0

    const emotionalIntensity = Math.round((random(i * 3 + 4) * 2 - 1) * 0.15 * 100) / 100

    return {
      shotId: `shot_${i}`,
      cameraDrift: Math.max(0, cameraDrift),
      timingShift,
      compositionDrift: Math.max(0, compositionDrift),
      emotionalIntensity: Math.max(-0.5, Math.min(0.5, emotionalIntensity)),
    }
  })
}

// ============================================================
// 3. SafetyClamp
// ============================================================

/**
 * 安全钳 — 确保 hard 约束不被污染
 */
export function safetyClamp(
  perturbations: ShotPerturbation[],
  resolvedField: ResolvedConstraintField,
): { perturbations: ShotPerturbation[]; clamps: number } {
  let clamps = 0

  // 检查 characterIdentity 是否为 hard
  const identityEntry = Object.entries(resolvedField).find(
    ([k, v]) => k === 'characterIdentity' && v.mode === 'hard',
  )
  if (identityEntry) {
    // characterIdentity hard → 不允许任何与角色扰动相关内容
    for (const p of perturbations) {
      // 目前没有身份相关的扰动字段，但为了安全钳的可扩展性保留此检查
      // 未来如果有 identityDrift 字段会在这里拦截
    }
  }

  // 全局 clamp：防止任何 shot 的扰动越过 0.3 上限
  for (const p of perturbations) {
    if (p.cameraDrift > 0.3) { p.cameraDrift = 0.3; clamps++ }
    if (p.compositionDrift > 0.3) { p.compositionDrift = 0.3; clamps++ }
    if (p.timingShift > 0.5) { p.timingShift = 0.5; clamps++ }
    if (p.timingShift < -0.5) { p.timingShift = -0.5; clamps++ }
    if (p.emotionalIntensity > 0.5) { p.emotionalIntensity = 0.5; clamps++ }
    if (p.emotionalIntensity < -0.5) { p.emotionalIntensity = -0.5; clamps++ }
  }

  return { perturbations, clamps }
}

// ============================================================
// 4. 统一入口
// ============================================================

/**
 * Creative Slack Engine — 统一入口
 *
 * 一步完成 slack 分析 → 扰动生成 → 安全钳
 */
export function executeSlackEngine(input: SlackEngineInput): SlackEngineOutput {
  // Step 1: 分析 slack 维度
  const dimensions = analyzeSlackDimensions(input.resolvedField, input.slackAllocation)

  // Step 2: 生成扰动
  const rawPerturbations = generateShotPerturbations(dimensions, input.shotCount)

  // Step 3: 安全钳
  const { perturbations, clamps } = safetyClamp(rawPerturbations, input.resolvedField)

  // 计算 slack 消费
  const slackConsumed = dimensions.reduce((sum, d) => sum + d.budget, 0)
  const slackRemaining = Math.max(0, input.slackAllocation.creativeSlack - slackConsumed)

  return {
    shotPerturbations: perturbations,
    slackConsumed: Math.round(slackConsumed * 100) / 100,
    slackRemaining: Math.round(slackRemaining * 100) / 100,
    report: {
      dimensions,
      consumptionBreakdown: Object.fromEntries(
        dimensions.map(d => [d.name, d.budget]),
      ),
      safetyClamps: clamps,
    },
  }
}
