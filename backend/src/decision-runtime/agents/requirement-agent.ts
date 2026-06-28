/**
 * requirement-agent.ts — Agent Skeleton
 *
 * Phase A.2: Agent Skeleton Layer
 *
 * 职责：
 *   1. 接收 DecisionProblem（已由 Cognition Layer 分解）
 *   2. 结合 ReasoningFrame 生成结构化搜索需求
 *   3. 输出 SearchRequirement（含 search queries）
 *
 * 禁止：
 *   ❌ 直接消费 string
 *   ❌ 自己猜测评估维度（必须走 ReasoningFrame）
 *
 * @phase decision-runtime
 */

import type { DecisionProblem } from '../cognition/decision-problem.js'
import type { ReasoningFrame } from '../cognition/reasoning-frame.js'
import type { SearchRequirement } from '../cognition/agent-contract.js'

export interface RequirementAgent {
  analyze(problem: DecisionProblem, frame: ReasoningFrame): Promise<SearchRequirement>
}

export type { DecisionProblem, ReasoningFrame, SearchRequirement }
