// causal-constraints/rules.ts — 因果治理规则

export class CausalRules {
  /**
   * UI 不能直接写 EntityGraph
   * UI 操作必须通过 Agent/Timeline 间接生效
   */
  static UI_CANNOT_DIRECT_ENTITY_WRITE = (ctx: {
    source: string
    affectedEntityIds?: string[]
  }) => {
    if (ctx.source === 'UI' && (ctx.affectedEntityIds?.length ?? 0) > 0) {
      return false // violation: UI 直接影响了 Entity
    }
    return true
  }

  /**
   * Timeline 事件必须引用已存在的 Entity
   * Timeline 不应凭空产生
   */
  static TIMELINE_MUST_REFERENCE_ENTITY = (ctx: {
    source: string
    affectedTimelineIds?: string[]
  }) => {
    if (ctx.source === 'Timeline') {
      return (ctx.affectedTimelineIds?.length ?? 0) > 0
    }
    return true
  }

  /**
   * Snapshot 上下文是只读的，不允许写操作
   */
  static SNAPSHOT_IS_READONLY = (ctx: {
    source: string
  }) => {
    return ctx.source !== 'Snapshot'
  }

  /**
   * Agent 写入 EntityGraph 必须附 reason
   */
  static AGENT_WRITE_MUST_HAVE_REASON = (ctx: {
    source: string
    reason?: string
  }) => {
    if (ctx.source === 'Agent' && !ctx.reason) {
      return false
    }
    return true
  }
}
