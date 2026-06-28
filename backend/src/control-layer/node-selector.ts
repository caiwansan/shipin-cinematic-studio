/**
 * Node Selection Runtime
 * Phase 4 — Execution Control Layer
 *
 * 轻量级选中运行时，跟踪当前选中的 DAG 节点。
 * 前端 + 后端共享同一稳定接口。
 */

export interface SelectedNode {
  id: string
  traceId: string
  type: 'DIRECTOR' | 'SCENE' | 'SHOT'
}

export class NodeSelector {
  private selected: SelectedNode | null = null

  select(node: SelectedNode): void {
    this.selected = node
  }

  get(): SelectedNode | null {
    return this.selected
  }

  clear(): void {
    this.selected = null
  }
}

// 全局单例（进程内）
export const globalNodeSelector = new NodeSelector()
