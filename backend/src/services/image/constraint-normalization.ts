// ============================================================
// constraint-normalization.ts
//
// 职责：Phase 4.1 — Constraint Normalization Layer（CNL）
//   把异构的 syncConstraints 映射到统一约束空间
//   让 D2/D3/Sync 可以统一推理
//
// 核心逻辑：
//   1. 统一约束表达空间（type/strength/scope/priority）
//   2. 跨类型冲突权重优先级
//   3. 输出 D2-ready vector space
//
// 设计原则：
//   - 不改变 syncConstraints 本身（transform only）
//   - 只改变"约束如何被消费"
//   - 不引入新语义（只映射已有信息到统一结构）
//
// 优先级规则（编译时常量）：
//   identity_lock > spatial > lighting > narrative
// ============================================================

import type { SyncConstraints } from './pipeline/types.js'

// ─── 统一约束表达 ──────────────────────────────────────

export interface ConstraintNormalized {
  /** 约束类型 */
  type: 'lighting' | 'spatial' | 'identity'
  /** 强度 0-1 */
  strength: number
  /** 作用域 */
  scope: 'global' | 'scene' | 'character'
  /** 优先级 0-1 */
  priority: number
  /** 领域级权重因子 */
  domainWeight: number
  /** 原始值（供 D2 做语义判断） */
  rawValue: string
}

// ─── 优先级常量 ────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  identity: 1.0,
  spatial: 0.75,
  lighting: 0.55,
}

const SCOPE_MAP: Record<string, 'global' | 'scene' | 'character'> = {
  identity: 'character',
  spatial: 'scene',
  lighting: 'global',
}

// ─── 强度归一化 ────────────────────────────────────────

/**
 * 将 semantic detail 映射到 strength 0-1
 *
 * 启发式规则：
 *   - 冲突信号越多 → 强度越高（因为需要被 attention）
 *   - 有明确偏好值 → 中等强度
 *   - 仅有框架值 → 低强度
 */
function normalizeStrength(
  type: string,
  rawValue: string,
  conflictCount: number,
): number {
  // 冲突是强度的强信号
  const conflictBoost = Math.min(0.4, conflictCount * 0.1)

  // 值丰富度：长描述 = 更明确
  const lengthScore = Math.min(0.3, rawValue.length / 50 * 0.3)

  // 基础强度（不同领域不同基线）
  const baseStrength: Record<string, number> = {
    identity: 0.7,
    spatial: 0.5,
    lighting: 0.4,
  }

  return Math.min(1, (baseStrength[type] ?? 0.4) + conflictBoost + lengthScore)
}

// ─── 主体映射函数 ──────────────────────────────────────

export function normalizeConstraints(sync: SyncConstraints): ConstraintNormalized[] {
  const result: ConstraintNormalized[] = []

  // Identity
  if (sync.identity) {
    result.push({
      type: 'identity',
      strength: normalizeStrength('identity', sync.identity.characterName, 0),
      scope: 'character',
      priority: PRIORITY_ORDER.identity,
      domainWeight: 0.35,
      rawValue: sync.identity.characterName,
    })
  }

  // Spatial
  if (sync.spatial) {
    const conflictCount = sync.lighting?.conflictSignals.length ?? 0
    result.push({
      type: 'spatial',
      strength: normalizeStrength('spatial', sync.spatial.layout, conflictCount),
      scope: 'scene',
      priority: PRIORITY_ORDER.spatial,
      domainWeight: 0.35,
      rawValue: sync.spatial.layout,
    })
  }

  // Lighting
  if (sync.lighting) {
    const conflictCount = sync.lighting.conflictSignals.length
    result.push({
      type: 'lighting',
      strength: normalizeStrength('lighting', sync.lighting.preferred, conflictCount),
      scope: conflictCount > 0 ? 'global' : 'scene',
      priority: PRIORITY_ORDER.lighting,
      domainWeight: 0.3,
      rawValue: sync.lighting.preferred,
    })
  }

  // 按优先级降序排列
  result.sort((a, b) => b.priority - a.priority)

  return result
}

// ─── 便捷方法 ──────────────────────────────────────────

export function getConstraintVector(sync: SyncConstraints): number[] {
  const normalized = normalizeConstraints(sync)
  // 输出固定 9 维向量：[type one-hot(3) + strength + scope(2) + priority + domainWeight + rawSignal]
  return normalized.flatMap(n => [
    n.type === 'identity' ? 1 : 0,
    n.type === 'spatial' ? 1 : 0,
    n.type === 'lighting' ? 1 : 0,
    n.strength,
    n.scope === 'global' ? 1 : n.scope === 'scene' ? 0.5 : 0,
    n.priority,
    n.domainWeight,
    1, // placeholder for future raw signal
  ])
}

// ─── 工具 ──────────────────────────────────────────────

export function normalizedToSummary(normalized: ConstraintNormalized[]): string {
  return normalized
    .map(n => `[${n.type}] strength=${n.strength.toFixed(2)} scope=${n.scope} priority=${n.priority}`)
    .join(' | ')
}
