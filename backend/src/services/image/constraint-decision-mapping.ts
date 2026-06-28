// ============================================================
// constraint-decision-mapping.ts
//
// 职责：Phase 4.1 — Constraint Decision Mapping Layer（CDML）
//   把归一化约束映射到决策偏置场（Bias Field）
//   让约束产生结构化的决策影响方向
//
// 核心逻辑：
//   1. Constraint → Decision Bias（映射类型/目标/权重/变换意图）
//   2. 生成 DecisionBiasField（决策空间形状修改器集合）
//   3. 不修改 D2/D3 路径（只声明 bias，待 D2/D3 消费）
//
// 设计原则：
//   - 不排序，不评分（这是 CNL 的工作）
//   - 不执行 transform（这是 D2/D3 Bridge 的工作）
//   - 只声明"约束希望决策空间怎么变"
//
// Bias 类型：
//   - hard:     必须执行（如 identity lock）
//   - soft:     偏好型（如 lighting preference）
//   - structural: 影响决策结构（如 spatial layout）
//
// 当前状态：transform 为存根（stub implementation）
//   实际 transform 将在 D2 Bridge 接入时实现
// ============================================================

import type { ConstraintNormalized } from './constraint-normalization.js'

// ─── 偏置类型 ──────────────────────────────────────────

export type BiasTarget = 'D2' | 'D3' | 'Prompt' | 'SceneGraph'
export type InfluenceType = 'hard' | 'soft' | 'structural'

export interface DecisionBias {
  /** 偏置来源约束类型 */
  source: string
  /** 作用目标 */
  target: BiasTarget
  /** 影响力类型 */
  influenceType: InfluenceType
  /** 偏置权重 0-1 */
  weight: number
  /** 约束优先级 */
  priority: number
  /** 原始值 */
  rawValue: string
  /** 变换存根（当前：记录意图，待 D2 Bridge 实现） */
  transform: {
    /** 变换意图描述 */
    intent: string
    /** 变换是否已实现 */
    implemented: boolean
  }
}

// ─── 偏置场 ────────────────────────────────────────────

export interface DecisionBiasField {
  biases: DecisionBias[]
  /** 场哈希（防静默突变） */
  integritySeal: string
  /** 场摘要 */
  summary: string
}

// ─── 约束→偏置 映射规则 ────────────────────────────────

const BIAS_RULES: Record<string, {
  target: BiasTarget
  influenceType: InfluenceType
  transformIntent: string
}> = {
  identity: {
    target: 'D2',
    influenceType: 'hard',
    transformIntent: 'applyCharacterAnchorLock: 锁定角色身份，D2 决策时禁止变更角色核心特征',
  },
  spatial: {
    target: 'SceneGraph',
    influenceType: 'structural',
    transformIntent: 'applySceneGraphBias: 空间布局约束映射到构图策略，影响 scene/storyboard 生成',
  },
  lighting: {
    target: 'Prompt',
    influenceType: 'soft',
    transformIntent: 'applyPromptStylingBias: 光照偏好注入 prompt styling 层，不强制覆盖',
  },
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

// ─── 构建偏置场 ────────────────────────────────────────

export function buildBiasField(normalized: ConstraintNormalized[]): DecisionBiasField {
  const biases: DecisionBias[] = normalized
    .filter(n => n.strength > 0.1) // 过滤无效约束
    .map(n => {
      const rule = BIAS_RULES[n.type] ?? {
        target: 'D2' as BiasTarget,
        influenceType: 'soft' as InfluenceType,
        transformIntent: `generic: ${n.type} 约束偏置，强度 ${n.strength}`,
      }

      return {
        source: n.type,
        target: rule.target,
        influenceType: rule.influenceType,
        weight: n.strength,
        priority: n.priority,
        rawValue: n.rawValue,
        transform: {
          intent: rule.transformIntent,
          implemented: false, // 存根：待 D2 Bridge
        },
      }
    })

  // 按影响力降序
  biases.sort((a, b) => {
    const typeOrder: Record<InfluenceType, number> = { hard: 3, structural: 2, soft: 1 }
    const aOrder = typeOrder[a.influenceType] ?? 0
    const bOrder = typeOrder[b.influenceType] ?? 0
    if (aOrder !== bOrder) return bOrder - aOrder
    return b.weight - a.weight
  })

  const summary = biases
    .map(b => `[${b.source}→${b.target}] ${b.influenceType} weight=${b.weight.toFixed(2)}: ${b.transform.intent.substring(0, 40)}...`)
    .join('\n')

  return {
    biases,
    integritySeal: simpleHash(biases),
    summary,
  }
}

// ─── 便捷方法 ──────────────────────────────────────────

export function biasFieldToVector(field: DecisionBiasField): number[] {
  // 固定输出：每个 bias 生产 5 维
  return field.biases.flatMap(b => [
    b.target === 'D2' ? 1 : b.target === 'D3' ? 0.75 : b.target === 'Prompt' ? 0.5 : 0.25,
    b.influenceType === 'hard' ? 1 : b.influenceType === 'structural' ? 0.5 : 0.25,
    b.weight,
    b.priority,
    b.transform.implemented ? 1 : 0,
  ])
}
