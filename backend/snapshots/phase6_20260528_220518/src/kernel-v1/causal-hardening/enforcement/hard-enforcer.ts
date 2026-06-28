// causal-hardening/enforcement/hard-enforcer.ts — 最终裁决层

import { CausalConstraintEngine } from '../../causal-constraints/constraint-engine.js'
import { KernelViolation } from '../intercept/pre-apply-gate.js'

export class CausalHardEnforcer {
  constructor(private engine: CausalConstraintEngine) {}

  enforce(command: {
    id: string
    source: string
    target: string
    type: string
    payload: {
      projectId: string
      entityId?: string
      parentEventId?: string
      reason?: string
    }
  }): void {
    const history: Array<{ id: string; parentEventId?: string }> = []

    // 强制执行约束
    this.engine.enforce(
      {
        id: command.payload.entityId ?? command.id,
        source: command.source,
        parentEventId: command.payload.parentEventId,
        affectedEntityIds: command.target === 'EntityGraph' ? [command.payload.entityId ?? ''].filter(Boolean) : [],
        affectedTimelineIds: command.target === 'Timeline' ? [command.payload.entityId ?? ''].filter(Boolean) : [],
        reason: command.payload.reason,
      },
      history,
    )
  }
}
