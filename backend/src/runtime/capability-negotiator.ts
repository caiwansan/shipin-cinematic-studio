/**
 * Capability Negotiator — 理想能力 → 执行环境可行能力
 *
 * ═══════════════════════════════════════════════════════════════
 * S3.2: Capability Negotiator
 *
 *   Capability Plan（理想 — 来自 Capability Planner）
 *   │
 *   └── negotiate() ── 纯函数
 *       │
 *       ▼
 *   ExecutableCapabilityPlan（可行 — 含降级策略）
 *
 * 核心原则：
 *   - Negotiator Never Invents Capability（只保留/降级/拒绝，不新增）
 *   - 不回答"如何执行"（那是 Execution Planner 的事）
 *   - 不回答"如何生成 Prompt"（那是 Provider Adapter 的事）
 *   - 不回答"如何调用 Provider"（那是 Worker Runtime 的事）
 *
 * ═══════════════════════════════════════════════════════════════
 */

import type { CapabilityPlan, ShotCapability, CapabilityLevel } from './capability-planner.js'

// ─── 类型定义 ──────────────────────────────────────────

/** 能力 ID — 使用命名空间标识，保证 Capability Registry 稳定 */
export const CapabilityIds = {
  CHARACTER_REFERENCE: 'film.character.reference',
  CAMERA_PATH: 'film.camera.path',
  KEYFRAME: 'film.keyframe',
  PHYSICS_CONSTRAINT: 'film.physics.constraint',
  LIP_SYNC: 'film.lip.sync',
  TEMPORAL_CONSISTENCY: 'film.temporal.consistency',
  LIGHTING_CONTROL: 'film.lighting.control',
  STYLE_TRANSFER: 'film.style.transfer',
  SPATIAL_LAYOUT: 'film.spatial.layout',
} as const

export type CapabilityId = (typeof CapabilityIds)[keyof typeof CapabilityIds]

/** 执行环境声明的能力支持级别 */
export type EnvironmentSupportLevel = 'full' | 'partial' | 'none' | 'unknown'

/** 降级策略 — 不写 Provider 名，只写执行策略 */
export interface FallbackStrategy {
  strategy: string          // e.g. 'prompt_guidance' | 'temporal_compensation' | 'static_camera'
  description: string       // 可读描述
}

/** 单能力的协商结果 */
export interface NegotiatedCapability {
  capabilityId: CapabilityId
  requested: CapabilityLevel
  resolved: CapabilityLevel
  supported: EnvironmentSupportLevel
  fallback: FallbackStrategy | null
  reason: string            // 为什么降级/拒绝
  confidence: number        // 0.0 ~ 1.0
}

/** 执行环境声明（Provider 无关，只描述能力支持情况） */
export interface ExecutionEnvironmentCapabilities {
  environmentId: string
  environmentVersion: string
  supportsParallel: boolean
  capabilities: Partial<Record<CapabilityId, {
    level: EnvironmentSupportLevel
    notes?: string
  }>>
}

/** 协商结果 — 镜头的可行能力 */
export interface ExecutableShotCapability {
  shotId: string
  capabilities: NegotiatedCapability[]
  overallFeasibility: 'feasible' | 'degraded' | 'blocked'
}

/** 可执行能力计划 — Negotiator 输出，Execution Planner 消费 */
export interface ExecutableCapabilityPlan {
  id: string
  sourcePlanId: string
  environmentId: string
  shots: ExecutableShotCapability[]
  metadata: {
    negotiatedAt: string
    totalShots: number
    feasibleShots: number
    degradedShots: number
    blockedShots: number
    overallFeasibility: 'feasible' | 'degraded' | 'blocked'
  }
}

/** 完整协商记录（可 Replay） */
export interface NegotiationRecord {
  id: string
  input: CapabilityPlan
  environment: ExecutionEnvironmentCapabilities
  output: ExecutableCapabilityPlan
  timestamp: string
}

// ─── 默认降级策略表 ───────────────────────────────────

const FALLBACK_STRATEGIES: Partial<Record<CapabilityId, FallbackStrategy>> = {
  [CapabilityIds.CAMERA_PATH]: {
    strategy: 'prompt_guidance',
    description: '无原生相机路径支持，通过 Prompt 引导产生运动感',
  },
  [CapabilityIds.PHYSICS_CONSTRAINT]: {
    strategy: 'temporal_compensation',
    description: '无原生物理约束支持，通过时序补偿保持视觉连贯',
  },
  [CapabilityIds.LIGHTING_CONTROL]: {
    strategy: 'prompt_guidance',
    description: '无原生光照控制支持，通过 Prompt 描述光照效果',
  },
  [CapabilityIds.STYLE_TRANSFER]: {
    strategy: 'reference_guidance',
    description: '无原生风格迁移支持，通过参考图引导风格一致性',
  },
  [CapabilityIds.KEYFRAME]: {
    strategy: 'sequential_generation',
    description: '无原生关键帧支持，通过逐帧顺序生成保持叙事连贯',
  },
}

// ─── 主协商函数 ────────────────────────────────────────

/**
 * 将理想 Capability Plan 协商为可执行 Capability Plan。
 *
 * @param plan - Capability Planner 输出的理想计划
 * @param environment - 执行环境的能力声明
 * @returns ExecutableCapabilityPlan
 */
export function negotiate(
  plan: CapabilityPlan,
  environment: ExecutionEnvironmentCapabilities,
): ExecutableCapabilityPlan {
  const shots: ExecutableShotCapability[] = []
  let feasibleCount = 0
  let degradedCount = 0
  let blockedCount = 0

  for (const shot of plan.shots) {
    const negotiated = negotiateShot(shot, environment)
    shots.push(negotiated)

    if (negotiated.overallFeasibility === 'feasible') feasibleCount++
    else if (negotiated.overallFeasibility === 'degraded') degradedCount++
    else blockedCount++
  }

  let overallFeasibility: ExecutableCapabilityPlan['metadata']['overallFeasibility']
  if (blockedCount > 0) {
    overallFeasibility = 'blocked'
  } else if (degradedCount > 0) {
    overallFeasibility = 'degraded'
  } else {
    overallFeasibility = 'feasible'
  }

  return {
    id: `exec_plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    sourcePlanId: plan.id,
    environmentId: environment.environmentId,
    shots,
    metadata: {
      negotiatedAt: new Date().toISOString(),
      totalShots: plan.shots.length,
      feasibleShots: feasibleCount,
      degradedShots: degradedCount,
      blockedShots: blockedCount,
      overallFeasibility,
    },
  }
}

/**
 * 完整的 Negotiation Record（可存储用于 Replay）
 */
export function createNegotiationRecord(
  input: CapabilityPlan,
  environment: ExecutionEnvironmentCapabilities,
  output: ExecutableCapabilityPlan,
): NegotiationRecord {
  return {
    id: `neg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    input,
    environment,
    output,
    timestamp: new Date().toISOString(),
  }
}

// ─── 内部函数 ──────────────────────────────────────────

/**
 * 将 Capability Plan 中的能力 ID 从 `film.camera.path` 格式转为
 * CapabilityIds 常量形式（用于匹配）。
 * 注意：CapabilityPlan 中的 key 是 'camera_path'（省略 film. 前缀）
 */
const KEY_TO_ID: Record<string, CapabilityId> = {
  character_reference: CapabilityIds.CHARACTER_REFERENCE,
  camera_path: CapabilityIds.CAMERA_PATH,
  keyframe: CapabilityIds.KEYFRAME,
  physics_constraint: CapabilityIds.PHYSICS_CONSTRAINT,
  lip_sync: CapabilityIds.LIP_SYNC,
  temporal_consistency: CapabilityIds.TEMPORAL_CONSISTENCY,
  lighting_control: CapabilityIds.LIGHTING_CONTROL,
  style_transfer: CapabilityIds.STYLE_TRANSFER,
  spatial_layout: CapabilityIds.SPATIAL_LAYOUT,
}

function negotiateShot(
  shot: ShotCapability,
  environment: ExecutionEnvironmentCapabilities,
): ExecutableShotCapability {
  const negotiated: NegotiatedCapability[] = []
  let hasBlocked = false
  let hasDegraded = false

  for (const [key, requestedLevel] of Object.entries(shot.needs)) {
    if (requestedLevel === 'none') continue // 不需要的能力跳过

    const capabilityId = KEY_TO_ID[key]
    if (!capabilityId) continue // 未知能力跳过

    const supported = environment.capabilities[capabilityId]?.level || 'unknown'
    const fallback = determineFallback(capabilityId, requestedLevel, supported)

    const resolved = determineResolvedLevel(requestedLevel, supported, fallback)
    const reason = buildReason(capabilityId, requestedLevel, supported, fallback)
    const confidence = determineConfidence(resolved, supported)

    if (resolved === 'none') hasBlocked = true
    else if (resolved !== requestedLevel) hasDegraded = true

    negotiated.push({
      capabilityId,
      requested: requestedLevel,
      resolved,
      supported,
      fallback,
      reason,
      confidence,
    })
  }

  const overallFeasibility: ExecutableShotCapability['overallFeasibility'] =
    hasBlocked ? 'blocked' :
    hasDegraded ? 'degraded' :
    'feasible'

  return {
    shotId: shot.shotId,
    capabilities: negotiated,
    overallFeasibility,
  }
}

function determineFallback(
  _capabilityId: CapabilityId,
  _requested: CapabilityLevel,
  supported: EnvironmentSupportLevel,
): FallbackStrategy | null {
  // 如果环境完全支持 → 不需要降级
  if (supported === 'full') return null
  // 如果完全不支持且需求为 none → 也不需要降级
  if (_requested === 'none') return null
  // 查找默认降级策略
  return FALLBACK_STRATEGIES[_capabilityId] || {
    strategy: 'prompt_guidance',
    description: '无原生支持，通过 Prompt 引导替代',
  }
}

function determineResolvedLevel(
  requested: CapabilityLevel,
  supported: EnvironmentSupportLevel,
  fallback: FallbackStrategy | null,
): CapabilityLevel {
  if (supported === 'full') return requested
  if (supported === 'partial') {
    // partial 支持 → 降一级
    if (requested === 'full') return 'partial'
    return requested
  }
  if (supported === 'none' || supported === 'unknown') {
    // 不支持但有 fallback → partial
    if (fallback) return 'partial'
    return 'none'
  }
  return 'partial'
}

function buildReason(
  capabilityId: CapabilityId,
  requested: CapabilityLevel,
  supported: EnvironmentSupportLevel,
  fallback: FallbackStrategy | null,
): string {
  if (supported === 'full') return '环境原生支持'
  if (supported === 'partial') return '环境部分支持，能力已降级'
  if (fallback) return `环境不支持，通过 ${fallback.strategy} 补偿`
  return '环境不支持，且无可用降级策略'
}

function determineConfidence(
  resolved: CapabilityLevel,
  supported: EnvironmentSupportLevel,
): number {
  if (resolved === 'none') return 0.0
  if (supported === 'full') return 1.0
  if (supported === 'partial') return 0.6
  if (supported === 'unknown') return 0.3
  return 0.5
}
