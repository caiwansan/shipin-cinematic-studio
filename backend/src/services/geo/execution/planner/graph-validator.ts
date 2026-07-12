// ============================================================
// Graph Validator — DAG 校验器 (RC3-1)
// ============================================================
// 使用 DFS（O(V+E)）进行环检测，避免递归栈溢出。
// 不修改任何 RC1/RC2 类型定义。

import type { PlanningStep, PlanningEdgeResult } from './planner.types'
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './planner.types'

export class GraphValidator {
  /**
   * 校验 DAG 合法性
   *
   * 检查项：
   *   1. 空图
   *   2. 自依赖
   *   3. 缺失依赖
   *   4. 环（DFS）
   *   5. 未知节点类型（警告）
   *   6. 无依赖节点（警告）
   */
  validate(
    steps: PlanningStep[],
    edges: PlanningEdgeResult[],
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const stepIds = new Set(steps.map((s) => s.id))

    // 1. 空图检查
    if (steps.length === 0) {
      errors.push({
        code: 'EMPTY_GRAPH',
        message: 'Planning steps cannot be empty',
      })
      return { valid: false, errors, warnings }
    }

    // 2. 自依赖检查
    for (const step of steps) {
      if (step.dependsOn.includes(step.id)) {
        errors.push({
          code: 'SELF_DEPENDENCY',
          message: `Node ${step.id} depends on itself`,
          nodeId: step.id,
        })
      }
    }

    // 3. 缺失依赖检查
    for (const step of steps) {
      for (const depId of step.dependsOn) {
        if (!stepIds.has(depId)) {
          errors.push({
            code: 'MISSING_DEPENDENCY',
            message: `Node ${step.id} depends on unknown node ${depId}`,
            nodeId: step.id,
          })
        }
      }
    }

    // 4. 环检测（DFS）
    const adjacency = new Map<string, string[]>()
    for (const step of steps) {
      adjacency.set(step.id, [])
    }
    for (const edge of edges) {
      const list = adjacency.get(edge.from)
      if (list) {
        list.push(edge.to)
      }
    }

    const visited = new Set<string>()
    const inStack = new Set<string>()

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId)
      inStack.add(nodeId)

      const neighbors = adjacency.get(nodeId) ?? []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true
        } else if (inStack.has(neighbor)) {
          return true
        }
      }

      inStack.delete(nodeId)
      return false
    }

    for (const step of steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) {
          errors.push({
            code: 'CYCLE_DETECTED',
            message: 'Cycle detected in execution graph',
          })
          break
        }
      }
    }

    // 5. 未知节点类型（警告）
    const validTypes = new Set([
      'discovery',
      'knowledge',
      'recommendation',
      'mission',
      'verification',
      'publishing',
      'custom',
    ])
    for (const step of steps) {
      if (!validTypes.has(step.type)) {
        warnings.push({
          code: 'UNKNOWN_NODE_TYPE',
          message: `Node ${step.id} has unknown type: ${step.type}`,
          nodeId: step.id,
        })
      }
    }

    // 6. 无依赖节点（警告）— 将作为根节点最先执行
    const nodesWithIncoming = new Set(edges.map((e) => e.to))
    for (const step of steps) {
      if (!nodesWithIncoming.has(step.id) && step.dependsOn.length === 0) {
        warnings.push({
          code: 'NODE_WITHOUT_DEPENDENCIES',
          message: `Node ${step.id} has no dependencies (will execute first)`,
          nodeId: step.id,
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
