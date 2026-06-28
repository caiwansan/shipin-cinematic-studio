// causal-constraints/validator.ts — 检查规则集生效

import { CausalRules } from './rules'
import { CausalViolation } from './types'
import { OrderChecker } from './order-checker'

export class CausalValidator {
  /**
   * 对事件执行全套规则校验
   * 返回所有违规（非阻塞，收集式）
   */
  validate(event: {
    id: string
    source: string
    parentEventId?: string
    affectedEntityIds?: string[]
    affectedTimelineIds?: string[]
    reason?: string
  }, history: Array<{ id: string; parentEventId?: string }>): CausalViolation[] {
    const violations: CausalViolation[] = []

    // 规则集校验
    if (!CausalRules.UI_CANNOT_DIRECT_ENTITY_WRITE(event)) {
      violations.push({
        type: 'DEPENDENCY_VIOLATION',
        message: 'UI cannot directly write EntityGraph',
        eventId: event.id,
      })
    }

    if (!CausalRules.SNAPSHOT_IS_READONLY(event)) {
      violations.push({
        type: 'DEPENDENCY_VIOLATION',
        message: 'Snapshot is read-only context',
        eventId: event.id,
      })
    }

    if (!CausalRules.TIMELINE_MUST_REFERENCE_ENTITY(event)) {
      violations.push({
        type: 'DEPENDENCY_VIOLATION',
        message: 'Timeline must reference at least one entity',
        eventId: event.id,
      })
    }

    if (!CausalRules.AGENT_WRITE_MUST_HAVE_REASON(event)) {
      violations.push({
        type: 'MISSING_CAUSE',
        message: 'Agent write must provide a reason',
        eventId: event.id,
      })
    }

    // 顺序校验（全局因果链）
    const orderCheck = OrderChecker.validateSingle(event, history)
    if (!orderCheck.valid) {
      violations.push({
        type: 'ORDER_VIOLATION',
        message: orderCheck.error,
        eventId: event.id,
      })
    }

    return violations
  }
}
