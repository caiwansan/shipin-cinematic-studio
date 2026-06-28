/**
 * evidence.agent.ts — Phase AG-2.1: Pass-through EvidenceAgent
 *
 * ═══════════════════════════════════════════════════════════════
 * 当前阶段：AG-2.1
 * 禁止: enrichment / transformation / LLM
 * 只做: pass-through
 *
 * AG-2.4 之前，这里不做任何事。
 * 保持 UniversalEvidence[] → UniversalEvidence[]
 *
 * @phase decision-runtime / ag-2.1
 */

import type { UniversalEvidence } from './universal-evidence.js'
import type { ReasoningFrame } from '../../cognition/reasoning-frame.js'

export class EvidenceAgent {
  /**
   * AG-2.1: 纯透传
   * 不区重、不排序、不改摘要
   */
  evaluate(evidences: UniversalEvidence[], _frame: ReasoningFrame): UniversalEvidence[] {
    return evidences
  }
}

export const evidenceAgent = new EvidenceAgent()
