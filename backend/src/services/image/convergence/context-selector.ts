// ============================================================
// convergence/context-selector.ts
//
// 职责：D4 Context Selector
//   根据当前制作阶段、domain 组合、语义意图，
//   生成 domain 权重矩阵，决定"权力分配"
//
// 设计原则：
//   - 不是"谁大听谁"，而是"当前阶段需要什么"
//   - 初稿阶段 → identity 权重最高
//   - 精修阶段 → scene/storyboard 权重上升
//   - 终审阶段 → video/temporal 权重最高
// ============================================================

import type { QualityDomain } from '../pipeline/validators/core/baseline-registry.js'
import type { ArbiterContext, ProductionPhase } from './types.js'

// ─── Domain 权重矩阵 ──────────────────────────────────

export interface DomainWeightMatrix {
  /** 各 domain 在当前 context 下的权重（0-1） */
  weights: Record<QualityDomain, number>
  /** 上下文描述 */
  description: string
}

// ─── 阶段权重表 ────────────────────────────────────────

/**
 * 各制作阶段下每个 domain 的默认权重
 *
 * 权重含义：该 domain 在当前阶段的重要程度
 * 1.0 = 最高优先级（不达标必须重做）
 * 0.0 = 该阶段不关心
 */
const PHASE_DOMAIN_WEIGHTS: Record<ProductionPhase, Record<QualityDomain, number>> = {
  draft: {
    character: 1.0,      // 角色定妆是 Identity Anchor，初稿也必须稳
    scene: 0.6,           // 场景初稿可以稍差，后面精修
    storyboard: 0.4,      // 分镜初稿只要叙事懂就行
    frame: 0.3,           // 单帧画面初稿容忍度最高
    video: 0.2,           // 视频初稿几乎不检查
  },
  polish: {
    character: 1.0,       // 角色始终最优先
    scene: 0.9,           // 场景精修比重上升
    storyboard: 0.8,      // 分镜叙事流开始重要
    frame: 0.6,           // 帧构图开始审查
    video: 0.4,           // 视频开始看基础质量
  },
  final: {
    character: 1.0,
    scene: 1.0,
    storyboard: 1.0,
    frame: 1.0,
    video: 1.0,           // 终审全部满权重
  },
  production: {
    character: 1.0,
    scene: 1.0,
    storyboard: 0.9,      // 发布时视频更重要
    frame: 0.9,
    video: 1.0,           // 视频质量直接影响发布
  },
}

// ─── 意图修正系数 ──────────────────────────────────────

const INTENT_MODIFIERS: Record<string, Partial<Record<QualityDomain, number>>> = {
  identity_preserve: {
    character: 0.15,      // 角色权重额外 +0.15
    scene: -0.10,         // 场景权重稍降
    frame: -0.10,
  },
  visual_coherence: {
    scene: 0.10,
    storyboard: 0.10,
    video: 0.15,
    character: -0.05,
  },
  narrative_flow: {
    storyboard: 0.20,
    video: 0.10,
    character: -0.05,
  },
}

// ─── 风险模式修正 ──────────────────────────────────────

const RISK_MODIFIERS: Record<string, number> = {
  conservative: 1.2,   // 保守模式权重放大
  normal: 1.0,
  exploratory: 0.7,    // 探索模式容忍度更高
}

// ─── API ───────────────────────────────────────────────

export function getDomainWeights(context: ArbiterContext): DomainWeightMatrix {
  const baseWeights = { ...PHASE_DOMAIN_WEIGHTS[context.phase] }

  // Intent 修正
  const intentMods = INTENT_MODIFIERS[context.intent]
  if (intentMods) {
    for (const [dom, delta] of Object.entries(intentMods)) {
      if (baseWeights[dom as QualityDomain] !== undefined) {
        baseWeights[dom as QualityDomain] = Math.max(0, Math.min(1,
          baseWeights[dom as QualityDomain] + delta
        ))
      }
    }
  }

  // 风险模式修正
  const riskFactor = RISK_MODIFIERS[context.riskMode]
  for (const dom of Object.keys(baseWeights) as QualityDomain[]) {
    baseWeights[dom] = Math.min(1, baseWeights[dom] * riskFactor)
  }

  // 仅返回 context 指定的 domain
  const filtered: Record<QualityDomain, number> = {} as Record<QualityDomain, number>
  for (const dom of context.domains) {
    filtered[dom] = baseWeights[dom] ?? 0.5
  }

  return {
    weights: filtered,
    description: `Phase=${context.phase} Intent=${context.intent} Risk=${context.riskMode}`,
  }
}
