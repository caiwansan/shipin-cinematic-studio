/**
 * P5 — ClusterManager（集群管理器）
 *
 * 集群的核心管理层：
 *  - 节点注册管理
 *  - 节点负载均衡调度
 *  - 故障转移
 *  - 集群状态聚合
 *
 * ═══ 宪法 ═══
 * 所有分布式任务调度必须经过 ClusterManager。
 * 集群中必须有至少一个存活节点才能执行任务。
 */

import type { ClusterNode } from './cluster-node.js'
import { nodeRegistry } from './node-registry.js'
import { heartbeatService } from './heartbeat-service.js'
import { Capability } from '../runtime/capabilities.js'

export interface DispatchTask {
  taskId: string
  capability: Capability
  payload: any
  userId: string
  priority?: number
}

export interface DispatchResult {
  success: boolean
  nodeId: string
  message: string
}

class ClusterManager {
  private thisNodeId: string = ''

  /**
   * 初始化集群（注册本机节点 + 启动心跳）
   */
  initialize(
    nodeId: string,
    host: string = 'localhost',
    port: number = 4002,
  ): void {
    this.thisNodeId = nodeId

    const capabilities = Object.values(Capability)

    const localNode = {
      nodeId,
      name: `node-${nodeId.substring(0, 6)}`,
      status: 'alive' as const,
      load: 0,
      capacity: 100,
      activeTasks: 0,
      capabilities,
      host,
      port,
      lastHeartbeat: Date.now(),
      startedAt: Date.now(),
    }

    nodeRegistry.register(localNode)
    heartbeatService.start()

    // 本机心跳刷新：每 5 秒更新 lastHeartbeat，防止单节点被自己标记 dead
    setInterval(() => {
      const node = nodeRegistry.get(nodeId)
      if (node) {
        node.lastHeartbeat = Date.now()
        // 如果之前被意外标记 dead，自动恢复
        if (node.status === 'dead') {
          node.status = 'alive'
          console.log(`[ClusterManager] ♻️ 本机节点 "${localNode.name}" 从 dead 恢复为 alive`)
        }
      }
    }, 5000)

    console.log(`[ClusterManager] 🚀 集群已初始化，本机节点 "${localNode.name}" (${nodeId.substring(0, 8)})`)
  }

  /**
   * 分派任务到最优节点
   */
  async dispatchTask(task: DispatchTask): Promise<DispatchResult> {
    const node = nodeRegistry.selectBestNode(task.capability)

    if (!node) {
      return {
        success: false,
        nodeId: '',
        message: `没有可用节点执行 capability "${task.capability}"`,
      }
    }

    console.log(`[ClusterManager] 📤 分派任务 "${task.taskId.substring(0, 8)}" → 节点 "${node.name}" (负载 ${(node.load * 100).toFixed(0)}%)`)

    // 本地执行
    if (node.nodeId === this.thisNodeId) {
      return {
        success: true,
        nodeId: node.nodeId,
        message: `本地节点 "${node.name}" 执行`,
      }
    }

    // 远程节点执行（stub，实际应调用远程 HTTP）
    return {
      success: true,
      nodeId: node.nodeId,
      message: `远程节点 "${node.name}" 执行（distributed stub）`,
    }
  }

  /**
   * 注册远程节点
   */
  registerRemoteNode(
    nodeId: string,
    name: string,
    host: string,
    port: number,
    capabilities?: string[],
  ): void {
    const node = {
      nodeId,
      name,
      status: 'alive' as const,
      load: 0,
      capacity: 100,
      activeTasks: 0,
      capabilities: capabilities || Object.values(Capability),
      host,
      port,
      lastHeartbeat: Date.now(),
      startedAt: Date.now(),
    }
    nodeRegistry.register(node)
    console.log(`[ClusterManager] 🔗 远程节点 "${name}" (${host}:${port}) 已加入集群`)
  }

  /**
   * 获取集群状态
   */
  getStatus() {
    const summary = nodeRegistry.getSummary()
    const nodes = nodeRegistry.getAllNodes().map(n => ({
      nodeId: n.nodeId,
      name: n.name,
      status: n.status,
      load: n.load,
      activeTasks: n.activeTasks,
      capacity: n.capacity,
      host: n.host,
      port: n.port,
      lastHeartbeat: n.lastHeartbeat,
      uptime: Date.now() - n.startedAt,
    }))

    return {
      summary,
      nodes,
      thisNodeId: this.thisNodeId,
    }
  }

  /**
   * 模拟节点故障
   */
  simulateNodeFailure(nodeId: string): void {
    const node = nodeRegistry.get(nodeId)
    if (node) {
      node.status = 'dead'
      console.warn(`[ClusterManager] ⚠️ 节点 "${node.name}" 已模拟故障`)
    }
  }
}

export const clusterManager = new ClusterManager()
