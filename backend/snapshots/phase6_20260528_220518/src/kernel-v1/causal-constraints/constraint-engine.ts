// causal-constraints/constraint-engine.ts — 核心执行层

import { CausalValidator } from './validator'
import { OrderChecker } from './order-checker'
import { CausalViolation } from './types'

export class CausalConstraintEngine {
  private validator: CausalValidator

  constructor() {
    this.validator = new CausalValidator()
  }

  /**
   * 对事件执行约束校验（阻塞式）
   * violations > 0 → throw Error
   */
  enforce(event: {
    id: string
    source: string
    parentEventId?: string
    affectedEntityIds?: string[]
    affectedTimelineIds?: string[]
    reason?: string
  }, history: Array<{ id: string; parentEventId?: string }>): void {
    const violations = this.validator.validate(event, history)

    if (violations.length > 0) {
      const message = violations.map(v => `[${v.type}] ${v.message}`).join(' | ')
      throw new Error(`[CAUSAL_VIOLATION] ${message}`)
    }
  }

  /**
   * 查询校验（非阻塞），返回违规列表
   */
  check(event: {
    id: string
    source: string
    parentEventId?: string
    affectedEntityIds?: string[]
    affectedTimelineIds?: string[]
    reason?: string
  }, history: Array<{ id: string; parentEventId?: string }>): CausalViolation[] {
    return this.validator.validate(event, history)
  }
}
