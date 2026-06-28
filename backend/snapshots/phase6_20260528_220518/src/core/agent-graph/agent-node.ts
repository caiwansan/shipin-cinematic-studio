/**
 * P3 — AgentNode（Agent 图节点）
 *
 * 图中的每个节点代表一个独立 Agent 执行单元。
 * 每个 Agent 绑定一个 Capability，通过 Cutover → ControlPlane 执行。
 *
 * ═══ 宪法 ═══
 * Agent 不得绕过 ControlPlane，不得持有 Provider 逻辑。
 * Agent 只能声明 Capability，不能声明 provider/model/vendor。
 */

import { Capability } from '../runtime/capabilities.js'

export type AgentStrategy = 'parallel' | 'sequential' | 'conditional'

export interface AgentNode {
  /** 节点唯一 ID */
  id: string
  /** Agent 名称 */
  name: string
  /** 绑定 Capability */
  capability: Capability
  /** 执行策略 */
  strategy: AgentStrategy
  /** 输入转换函数（可选，默认透传） */
  inputTransform?: (context: Map<string, any>) => any
  /** 条件分支函数（仅 strategy=conditional 时使用） */
  condition?: (context: Map<string, any>) => boolean
  /** 依赖的上游节点 ID */
  dependsOn: string[]
  /** 元数据 */
  metadata?: {
    label?: string
    description?: string
    timeout?: number
    priority?: number
  }
}
