/**
 * Causal Story Generator
 * Phase 6 — Execution Memory Layer
 *
 * 因果解释引擎：将版本变更转化为人类可读的解释。
 * 回答 "为什么这个 shot 被重新生成了？" 之类的问题。
 */

export interface CausalStory {
  summary: string
  detail: string[]
  trace: string[]
}

export class CausalStoryGenerator {
  /**
   * 解释一次变更的因果链
   */
  explain(change: string, affected: string[], reason?: string): CausalStory {
    const detail = affected.map(a => `- ${a} 被标记为 ${this.getStatus(a, change)}`)

    return {
      summary: reason
        ? `因为 "${reason}"，修改 ${change} 触发了 ${affected.length} 个节点的级联变化`
        : `修改 ${change} 触发了 ${affected.length} 个节点的级联变化`,
      detail,
      trace: [change, ...affected],
    }
  }

  /**
   * 解释两个版本之间的差异
   */
  explainDiff(
    versionId: string,
    changed: string[],
    invalidated: string[],
  ): CausalStory {
    const all = [...new Set([...changed, ...invalidated])]

    return {
      summary: `版本 ${versionId.slice(0, 8)} 影响了 ${all.length} 个节点（${changed.length} 变更 + ${invalidated.length} 失效）`,
      detail: [
        ...changed.map(id => `- ${id} 被直接修改`),
        ...invalidated.filter(id => !changed.includes(id)).map(id => `- ${id} 因果失效（DIRTY）`),
      ],
      trace: all,
    }
  }

  /**
   * 解释整个 trace 的执行历史
   */
  explainHistory(
    traceId: string,
    versionCount: number,
    changeCount: number,
  ): CausalStory {
    return {
      summary: `执行 ${traceId} 共有 ${versionCount} 个版本，其中 ${changeCount} 次变更`,
      detail: [
        `- 版本总数: ${versionCount}`,
        `- 变更次数: ${changeCount}`,
      ],
      trace: [],
    }
  }

  private getStatus(nodeId: string, change: string): string {
    return nodeId === change ? 'REGENERATE' : 'DIRTY'
  }
}
