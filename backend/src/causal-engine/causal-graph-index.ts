/**
 * Causal Graph Index
 * Phase 5 — Causal Consistency Engine
 *
 * 因果索引层：管理 DAG 中所有因果边。
 * 每个 CausalEdge 代表一个因果关系（from → to）：
 *   - DIRECT: 直接依赖（scene → shot）
 *   - DERIVED: 派生依赖（scene 内容影响另一 scene）
 *   - RENDER_DEP: 渲染依赖（渲染结果被下游消费）
 *
 * getDownstream: 给定节点 → 所有受其影响的节点
 * getUpstream: 给定节点 → 所有影响它的节点
 */

export interface CausalEdge {
  from: string
  to: string
  type: 'DIRECT' | 'DERIVED' | 'RENDER_DEP'
}

export class CausalGraphIndex {
  private _edges: CausalEdge[] = []

  /** 获取所有边（只读快照） */
  get edges(): readonly CausalEdge[] {
    return this._edges
  }

  /** 添加一条因果边 */
  add(edge: CausalEdge): void {
    // 去重：同一对 from→to 同类型不重复添加
    const exists = this._edges.some(
      e => e.from === edge.from && e.to === edge.to && e.type === edge.type,
    )
    if (!exists) {
      this._edges.push(edge)
    }
  }

  /** 批量添加因果边 */
  addMany(edges: CausalEdge[]): void {
    for (const e of edges) {
      this.add(e)
    }
  }

  /** 获取下游节点（所有被 nodeId 影响的节点） */
  getDownstream(nodeId: string): string[] {
    return this._edges
      .filter(e => e.from === nodeId)
      .map(e => e.to)
  }

  /** 获取上游节点（所有影响 nodeId 的节点） */
  getUpstream(nodeId: string): string[] {
    return this._edges
      .filter(e => e.to === nodeId)
      .map(e => e.from)
  }

  /** 移除与指定节点相关的所有边 */
  removeNode(nodeId: string): void {
    this._edges = this._edges.filter(
      e => e.from !== nodeId && e.to !== nodeId,
    )
  }

  /** 从 blueprint 初始化因果索引 */
  static fromBlueprint(blueprint: any): CausalGraphIndex {
    const index = new CausalGraphIndex()
    const raw = blueprint?.data ?? blueprint

    if (raw.director) {
      for (const scene of raw.scenes || []) {
        index.add({
          from: raw.director.id,
          to: scene.id,
          type: 'DIRECT',
        })

        for (const shot of scene.shots || []) {
          index.add({ from: scene.id, to: shot.id, type: 'DIRECT' })
        }
      }
    }

    // 跨场景因果边：连续场景之间的渲染依赖
    const scenes = raw.scenes || []
    for (let i = 1; i < scenes.length; i++) {
      index.add({
        from: scenes[i - 1].id,
        to: scenes[i].id,
        type: 'RENDER_DEP',
      })
    }

    return index
  }

  /** 导出为可序列化的边列表 */
  toJSON(): CausalEdge[] {
    return [...this._edges]
  }
}
