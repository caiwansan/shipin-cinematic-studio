/**
 * Forbidden Transition Matrix
 * 禁止转换矩阵 — 检查因果图中是否存在非法的叙事转换
 *
 * 核心规则：
 *   peak → build: 越级回归
 *   release → peak: 时间反转
 *   emotion_high → emotion_low 无过渡: 情绪断裂
 *   character_death → character_active: 角色复活（除非 reset arc）
 */

import {
  DirectorCausalGraph,
} from '../causal-graph/causal-graph-types.js'
import {
  NarrativeConstraint,
  ConstraintViolation,
} from './narrative-constraint-types.js'

export interface TransitionCheckResult {
  hasViolation: boolean
  violations: ConstraintViolation[]
  foundTransitions: DetectedTransition[]
}

export interface DetectedTransition {
  fromNodeId: string
  toNodeId: string
  shotIndexA: number
  shotIndexB: number
  pattern: string
}

/**
 * 内置禁止转换规则（高于用户配置的硬规则）
 */
const BUILTIN_FORBIDDEN: Record<string, string> = {
  'peak→build': '峰值后不能回退到上升段',
  'release→peak': '释放后不能回到峰值（时间反转）',
  'explosive→calm': '情绪从爆发突降到平静（缺少过渡）',
  'death→alive': '角色死亡后不能复活（除非 reset arc）',
}

/**
 * 检查图中所有相邻转换
 */
export function checkTransitions(
  graph: DirectorCausalGraph,
  constraint: NarrativeConstraint,
): TransitionCheckResult {
  const violations: ConstraintViolation[] = []
  const foundTransitions: DetectedTransition[] = []

  if (!graph || !graph.edges) {
    return { hasViolation: false, violations, foundTransitions }
  }

  // 遍历所有边
  for (const edge of graph.edges) {
    const fromNode = graph.nodes.get(edge.from)
    const toNode = graph.nodes.get(edge.to)

    if (!fromNode || !toNode) continue

    // 只有同镜头的跨层边才算转换
    if (fromNode.shotIndex === toNode.shotIndex) continue

    // 提取状态值
    const fromState = extractDominantState(fromNode)
    const toState = extractDominantState(toNode)

    const pattern = `${fromState}→${toState}`

    foundTransitions.push({
      fromNodeId: edge.from,
      toNodeId: edge.to,
      shotIndexA: fromNode.shotIndex,
      shotIndexB: toNode.shotIndex,
      pattern,
    })

    // 检查内置规则
    if (BUILTIN_FORBIDDEN[pattern]) {
      violations.push({
        ruleId: `builtin-forbidden-${pattern}`,
        reason: 'forbidden_transition',
        nodeId: edge.to,
        shotIndex: toNode.shotIndex,
        message: `禁止转换: ${BUILTIN_FORBIDDEN[pattern]}`,
        severity: constraint.strictMode ? 'error' : 'warning',
      })
    }

    // 检查用户配置的禁止转换
    for (const rule of constraint.forbiddenTransitions) {
      if (pattern.includes(rule.from) && pattern.includes(rule.to)) {
        violations.push({
          ruleId: `user-forbidden-${rule.from}→${rule.to}`,
          reason: rule.reason,
          nodeId: edge.to,
          shotIndex: toNode.shotIndex,
          message: `禁止转换: ${rule.description || pattern}`,
          severity: constraint.strictMode ? 'error' : 'warning',
          suggestion: '建议插入过渡镜头',
        })
      }
    }
  }

  return {
    hasViolation: violations.length > 0,
    violations,
    foundTransitions,
  }
}

/**
 * 提取节点的主导状态值
 */
function extractDominantState(node: any): string {
  const state = node.state ?? {}
  // 按优先级提取
  return state.mood
    ?? state.grammarType
    ?? state.motionStyle
    ?? state.type
    ?? 'unknown'
}

/**
 * 判断一个转换是否被禁止（独立查询函数）
 */
export function isForbidden(
  fromState: string,
  toState: string,
  constraint: NarrativeConstraint,
): { forbidden: boolean; reason?: string } {
  const pattern = `${fromState}→${toState}`

  if (BUILTIN_FORBIDDEN[pattern]) {
    return { forbidden: true, reason: BUILTIN_FORBIDDEN[pattern] }
  }

  for (const rule of constraint.forbiddenTransitions) {
    if (pattern.includes(rule.from) && pattern.includes(rule.to)) {
      return { forbidden: true, reason: rule.description }
    }
  }

  return { forbidden: false }
}
