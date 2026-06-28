/**
 * evidence-agent.ts — Agent Skeleton
 *
 * Phase A.2: Agent Skeleton Layer
 *
 * 职责：
 *   1. 从原始搜索结果中提取可信证据
 *   2. 过滤噪音/重复/低质量信息
 *   3. 关联证据到评估轴
 *
 * 禁止：
 *   ❌ 修改原始证据内容（只做筛选和标记）
 *   ❌ 独立发明评估轴
 *
 * @phase decision-runtime
 */

import type { ContractEvidence, ReasoningFrame } from '../cognition/agent-contract.js'

export interface EvidenceAgent {
  evaluate(evidences: ContractEvidence[], frame: ReasoningFrame): Promise<ContractEvidence[]>
}

export type { ContractEvidence, ReasoningFrame }
