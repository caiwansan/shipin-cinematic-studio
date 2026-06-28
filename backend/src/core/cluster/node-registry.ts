/**
 * P5 — NodeRegistry（节点注册中心）
 *
 * 管理集群中所有节点的注册、发现和状态跟踪。
 *
 * ═══ 宪法 ═══
 * 节点必须先注册再使用。未注册节点不接受任何任务。
 * 状态为 'dead' 的节点不会接收到任务。
 */

import type { ClusterNode, NodeStatus } from './cluster-node.js'

class NodeRegistry {
  private nodes: Map<string, ClusterNode> = new Map()

  /**
   * 注册节点
   */
  register(node: ClusterNode): void {
    this.nodes.set(node.nodeId, node)
    console.log(`[NodeRegistry] ✅ 节点 "${node.name}" (${node.nodeId.substring(0, 8)}) 已注册，地址 ${node.host}:${node.port}`)
  }

  /**
   * 注销节点
   */
  unregister(nodeId: string): boolean {
    const existed = this.nodes.delete(nodeId)
    if (existed) console.log(`[NodeRegistry] ❌ 节点 "${nodeId.substring(0, 8)}" 已注销`)
    return existed
  }

  /**
   * 获取节点
   */
  get(nodeId: string): ClusterNode | undefined {
    return this.nodes.get(nodeId)
  }

  /**
   * 获取所有存活节点
   */
  getAliveNodes(): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(n => n.status !== 'dead')
  }

  /**
   * 获取所有节点（含 dead）
   */
  getAllNodes(): ClusterNode[] {
    return Array.from(this.nodes.values())
  }

  /**
   * 更新节点状态
   */
  updateStatus(nodeId: string, status: NodeStatus): void {
    const node = this.nodes.get(nodeId)
    if (node) node.status = status
  }

  /**
   * 更新节点负载信息
   */
  updateLoad(nodeId: string, load: number, activeTasks: number): void {
    const node = this.nodes.get(nodeId)
    if (node) {
      node.load = load
      node.activeTasks = activeTasks
      node.lastHeartbeat = Date.now()
    }
  }

  /**
   * 选择最佳节点（最少负载）
   */
  selectBestNode(capability?: string): ClusterNode | null {
    const alive = this.getAliveNodes()
      .filter(n => !capability || n.capabilities.includes(capability))

    if (alive.length === 0) return null

    return alive.sort((a, b) => {
      // 按负载排序，同负载按活跃任务数
      const loadDiff = a.load - b.load
      if (Math.abs(loadDiff) > 0.01) return loadDiff
      return a.activeTasks - b.activeTasks
    })[0]
  }

  /**
   * 健康检查（标记超时节点为 dead）
   */
  checkHealth(timeoutMs: number = 10000): void {
    const now = Date.now()
    for (const [, node] of this.nodes) {
      if (node.status === 'dead') continue
      if (now - node.lastHeartbeat > timeoutMs) {
        node.status = 'dead'
        console.warn(`[NodeRegistry] 💀 节点 "${node.name}" (${node.nodeId.substring(0, 8)}) 心跳超时，标记为 dead`)
      }
    }
  }

  /**
   * 获取集群状态概述
   */
  getSummary(): { total: number; alive: number; degraded: number; dead: number; avgLoad: number } {
    const all = this.getAllNodes()
    const alive = all.filter(n => n.status === 'alive')
    const degraded = all.filter(n => n.status === 'degraded')
    const dead = all.filter(n => n.status === 'dead')

    return {
      total: all.length,
      alive: alive.length,
      degraded: degraded.length,
      dead: dead.length,
      avgLoad: alive.length > 0
        ? alive.reduce((s, n) => s + n.load, 0) / alive.length
        : 0,
    }
  }
}

export const nodeRegistry = new NodeRegistry()
