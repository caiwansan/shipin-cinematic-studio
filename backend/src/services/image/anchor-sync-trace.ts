// ============================================================
// anchor-sync-trace.ts
//
// 职责：Phase 4.1 — Anchor Sync Trace & Drift Detection
//   把 Anchor Sync 的约束生成过程可审计化
//   提供 Prompt Proxy Drift（Phase 1 surrogate metric）
//
// 设计原则：
//   - 只记录，不改变系统状态
//   - 不依赖外部模型（纯字符串语义距离）
//   - prompt drift ≠ output drift（明确标记 Phase 1）
// ============================================================

import type { ExecutionContext } from './pipeline/types.js'

// ─── Trace 输出 ────────────────────────────────────────

export interface ConstraintInfluenceTrace {
  /** 世界快照哈希 */
  snapshotHash: string
  /** 约束投影明细 */
  projectionMap: Array<{
    source: string
    target: string
    preferred: string
  }>
  /** 预消解动作 */
  preResolveActions: Array<{
    type: string
    resolution: string
    resolved: boolean
  }>
  /** 数据完整性封印（防止静默突变） */
  integritySeal: string
  /** 当前语义落地的 proxy 方式 */
  driftStage: 'PHASE_1_PROMPT_PROXY' | 'PHASE_2_IMAGE_EMBEDDING' | 'PHASE_3_SCENE_GRAPH'
}

export interface AnchorDriftResult {
  /** Phase 1: prompt proxy drift score */
  driftScore: number
  /** 是否检测到约束丢失 */
  constraintLossSignals: string[]
  /** 约束覆盖度（constraint 被 prompt 继承的比例） */
  coverage: number
  /** 标记当前 drift 测量级别 */
  type: 'PROMPT_PROXY'
  /** 原始数据 */
  raw: {
    constraintProjection: string
    promptText: string
  }
}

// ─── 简单哈希 ──────────────────────────────────────────

function simpleHash(obj: unknown): string {
  const str = JSON.stringify(obj)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// ─── 语义距离（简化版：关键词重叠率） ─────────────────

const CONSTRAINT_KEYWORDS: Record<string, string[]> = {
  lighting: ['光照', '光线', '灯光', '阴影', '逆光', '柔光', '硬光', '自然光', '顶光', '侧光', '黄昏', '日落', '阳光', '月光', '霓虹灯', '明亮', '昏暗', '暖色', '冷色'],
  spatial: ['近景', '中景', '远景', '特写', '前景', '背景', '远处', '近处', '左', '右', '前', '后', '上', '下', '中', '室内', '室外'],
  identity: ['冷峻', '温婉', '霸气', '柔弱', '严肃', '微笑', '皱眉', '白衣', '黑衣', '红衣', '铠甲', '长袍'],
}

function keywordOverlap(keywords: string[], text: string): number {
  if (keywords.length === 0) return 1
  const lowerText = text.toLowerCase()
  const matched = keywords.filter(kw => lowerText.includes(kw.toLowerCase()))
  return matched.length / keywords.length
}

// ─── Task A: Trace Constraint Influence ────────────────

export function traceConstraintInfluence(ctx: ExecutionContext): ConstraintInfluenceTrace | null {
  const sync = ctx.syncConstraints
  if (!sync) return null

  const projectionMap: ConstraintInfluenceTrace['projectionMap'] = []
  const preResolveActions: ConstraintInfluenceTrace['preResolveActions'] = []

  // Light projection
  if (sync.lighting) {
    projectionMap.push({
      source: sync.lighting.conflictSources.join(','),
      target: 'lighting',
      preferred: sync.lighting.preferred,
    })
    for (const sig of sync.lighting.conflictSignals) {
      preResolveActions.push({
        type: 'lighting_conflict',
        resolution: 'weighted_blend',
        resolved: true,
      })
    }
  }

  // Spatial projection
  if (sync.spatial) {
    projectionMap.push({
      source: sync.spatial.source,
      target: 'spatial',
      preferred: sync.spatial.layout,
    })
  }

  // Identity projection
  if (sync.identity) {
    projectionMap.push({
      source: 'character',
      target: 'identity',
      preferred: sync.identity.characterName,
    })
  }

  const integritySeal = simpleHash(sync)

  return {
    snapshotHash: simpleHash({
      character: sync.identity?.characterName,
      lighting: sync.lighting?.preferred,
      spatial: sync.spatial?.layout,
    }),
    projectionMap,
    preResolveActions,
    integritySeal,
    driftStage: 'PHASE_1_PROMPT_PROXY',
  }
}

// ─── Task C: Compute Anchor Drift (Prompt Proxy) ───────

/**
 * 计算 prompt proxy drift
 *
 * 方法：
 *   - 从 ctx.syncConstraints 提取约束关键词集合
 *   - 从 ctx.finalPrompt 计算关键词命中率
 *   - driftScore = 1 - 加权匹配率（越高 = 漂移越大）
 *
 * 局限性：
 *   - 只测 "constraint → prompt" 编译器正确性
 *   - 不测 "prompt → image" 渲染保真度
 *   - 当前仅 Phase 1 PROMPT_PROXY 级别
 */
export function computeAnchorDrift(ctx: ExecutionContext): AnchorDriftResult | null {
  const sync = ctx.syncConstraints
  const prompt = ctx.finalPrompt
  if (!sync || !prompt) return null

  const constraintLossSignals: string[] = []
  let totalWeight = 0
  let weightedMatch = 0

  // lighting drift
  if (sync.lighting) {
    const keywords = CONSTRAINT_KEYWORDS.lighting
    const overlap = keywordOverlap(keywords, prompt)
    weightedMatch += overlap * 0.4
    totalWeight += 0.4
    if (overlap < 0.3) {
      constraintLossSignals.push(`lighting: 约束关键词命中率低 (${(overlap * 100).toFixed(0)}%)`)
    }
  }

  // spatial drift
  if (sync.spatial) {
    const keywords = CONSTRAINT_KEYWORDS.spatial
    const overlap = keywordOverlap(keywords, prompt)
    weightedMatch += overlap * 0.35
    totalWeight += 0.35
    if (overlap < 0.3) {
      constraintLossSignals.push(`spatial: 约束关键词命中率低 (${(overlap * 100).toFixed(0)}%)`)
    }
  }

  // identity drift
  if (sync.identity) {
    const keywords = CONSTRAINT_KEYWORDS.identity
    const overlap = keywordOverlap(keywords, prompt)
    weightedMatch += overlap * 0.25
    totalWeight += 0.25
    if (overlap < 0.3) {
      constraintLossSignals.push(`identity: 约束关键词命中率低 (${(overlap * 100).toFixed(0)}%)`)
    }
  }

  const coverage = totalWeight > 0 ? weightedMatch / totalWeight : 1
  const driftScore = Math.max(0, Math.min(1, 1 - coverage))

  return {
    driftScore: Math.round(driftScore * 1000) / 1000,
    constraintLossSignals,
    coverage: Math.round(coverage * 1000) / 1000,
    type: 'PROMPT_PROXY',
    raw: {
      constraintProjection: JSON.stringify(sync),
      promptText: prompt.substring(0, 500),
    },
  }
}
