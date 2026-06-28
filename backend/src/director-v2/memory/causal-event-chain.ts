/**
 * memory/causal-event-chain.ts — Phase 7 因果事件链
 *
 * 存储场景之间的因果关系：
 *   - 为什么一个场景存在（cause → effect）
 *   - 场景之间的强度关联
 *   - 语义关联（同一 Subject 延续、冲突解决等）
 *
 * 宪法：
 *   - 不可修改 IR/StoryGraph/Timeline
 *   - 结构化数据（非文本/log）
 *   - 可被 Adaptive Kernel 和未来 Narrative Identity System 消费
 */

// ─── 类型 ─────────────────────────────────────────────────

export interface CausalLink {
  eventId: string
  causeScene: string
  effectScene: string
  linkType: 'caused_by' | 'resolves' | 'intensifies' | 'contrasts' | 'continues'
  confidence: number     // 0-1（来自 ExecutionPlan/IR 的确定性，非 LLM）
  intensityDelta: number // 效果场景 vs 原因场景的强度变化
  semanticDescription: string
}

// ─── CausalEventChain ────────────────────────────────────

export class CausalEventChain {
  private links: CausalLink[] = []
  private nextId = 0

  /** 添加因果链接 */
  addLink(
    causeScene: string,
    effectScene: string,
    linkType: CausalLink['linkType'],
    intensityDelta: number,
    description: string,
    confidence: number = 1.0,
  ): CausalLink {
    const link: CausalLink = {
      eventId: `causal_${this.nextId++}`,
      causeScene,
      effectScene,
      linkType,
      confidence,
      intensityDelta,
      semanticDescription: description,
    }
    this.links.push(link)
    return link
  }

  /** 查询某场景的因果链 */
  getCauses(sceneId: string): CausalLink[] {
    return this.links.filter(l => l.effectScene === sceneId)
  }

  /** 查询某场景产生的因果影响 */
  getEffects(sceneId: string): CausalLink[] {
    return this.links.filter(l => l.causeScene === sceneId)
  }

  /** 查询完整因果链（前溯） */
  getCausalChainForward(fromScene: string): CausalLink[] {
    const chain: CausalLink[] = []
    const visited = new Set<string>()
    const queue = [fromScene]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      const outLinks = this.links.filter(l => l.causeScene === current)
      for (const link of outLinks) {
        chain.push(link)
        queue.push(link.effectScene)
      }
    }
    return chain
  }

  /** 查询反向因果链（后溯） */
  getCausalChainBackward(fromScene: string): CausalLink[] {
    const chain: CausalLink[] = []
    const visited = new Set<string>()
    const queue = [fromScene]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      const inLinks = this.links.filter(l => l.effectScene === current)
      for (const link of inLinks) {
        chain.push(link)
        queue.push(link.causeScene)
      }
    }
    return chain
  }

  /** 获取强度传播量：场景 A 的强度通过因果链传播多远 */
  getIntensityPropagation(fromScene: string): number {
    const chain = this.getCausalChainForward(fromScene)
    return chain.reduce((sum, l) => sum + Math.abs(l.intensityDelta), 0)
  }

  /** 查询因果关系类型统计 */
  getLinkTypeStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const l of this.links) {
      stats[l.linkType] = (stats[l.linkType] ?? 0) + 1
    }
    return stats
  }

  /** 导出快照 */
  snapshot(): Record<string, unknown> {
    return {
      totalLinks: this.links.length,
      linkTypes: this.getLinkTypeStats(),
      chainLength: this.links.length,
      links: this.links.map(l => ({
        id: l.eventId,
        cause: l.causeScene,
        effect: l.effectScene,
        type: l.linkType,
        delta: l.intensityDelta,
      })),
    }
  }

  clear(): void {
    this.links = []
    this.nextId = 0
  }
}

export default CausalEventChain
