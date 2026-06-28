/**
 * P3 — AgentEdge（Agent 图边）
 *
 * 定义节点间的依赖关系和数据流。
 */

import type { AgentNode } from './agent-node.js'

export interface AgentEdge {
  /** 源节点 ID */
  from: string
  /** 目标节点 ID */
  to: string
  /** 数据转换函数（可选） */
  dataTransform?: (input: any) => any
  /** 标签 */
  label?: string
}

export function createEdge(from: AgentNode, to: AgentNode, label?: string): AgentEdge {
  return { from: from.id, to: to.id, label }
}
