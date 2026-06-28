// causal-constraints/order-checker.ts — 时间因果顺序校验

export class OrderChecker {
  /**
   * 校验事件链的因果顺序一致性
   * parentEventId 必须在子事件之前已存在
   */
  static validateOrder(events: Array<{ id: string; parentEventId?: string }>) {
    const seen = new Set<string>()

    for (const e of events) {
      if (e.parentEventId && !seen.has(e.parentEventId)) {
        return {
          valid: false as const,
          error: `Event ${e.id.slice(0, 8)} depends on missing parent ${e.parentEventId.slice(0, 8)}`,
        }
      }
      seen.add(e.id)
    }

    return { valid: true as const }
  }

  /**
   * 校验单个事件在历史中的因果合法性
   * parentEventId 必须在历史中
   */
  static validateSingle(event: { id: string; parentEventId?: string }, history: Array<{ id: string }>) {
    if (event.parentEventId) {
      const found = history.some(h => h.id === event.parentEventId)
      if (!found) {
        return {
          valid: false as const,
          error: `Parent event ${event.parentEventId.slice(0, 8)} not found in history`,
        }
      }
    }
    return { valid: true as const }
  }
}
