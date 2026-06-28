/**
 * search-agent.ts — Agent Skeleton
 *
 * Phase A.2: Agent Skeleton Layer
 *
 * 职责：
 *   1. 根据 SearchRequirement 执行搜索
 *   2. 收集原始信息（当前使用模拟数据）
 *   3. 输出原始搜索证据
 *
 * 禁止：
 *   ❌ 独立决定搜索目标（必须从 SearchRequirement 读取）
 *
 * @phase decision-runtime
 */

import type { SearchRequirement, ContractEvidence } from '../cognition/agent-contract.js'

export interface SearchAgent {
  search(requirement: SearchRequirement): Promise<ContractEvidence[]>
}

export type { SearchRequirement, ContractEvidence }
