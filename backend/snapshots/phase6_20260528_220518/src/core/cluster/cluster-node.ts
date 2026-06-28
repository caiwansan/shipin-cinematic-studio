/**
 * P5 — ClusterNode（集群节点模型）
 *
 * 集群中的每个执行单元称为一个节点。
 * 节点是 P5 分布式调度的基础抽象。
 *
 * ═══ 宪法 ═══
 * 所有任务必须从 Cluster 视角调度，禁止直接寻址某个节点。
 * 节点状态必须通过 HeartbeatService 定期更新。
 */

export type NodeStatus = 'alive' | 'degraded' | 'dead'

export interface ClusterNode {
  /** 节点唯一 ID */
  nodeId: string
  /** 节点名称 */
  name: string
  /** 状态 */
  status: NodeStatus
  /** 当前负载（0.0 ~ 1.0） */
  load: number
  /** 最大任务容量 */
  capacity: number
  /** 当前执行任务数 */
  activeTasks: number
  /** 支持的 Capability 列表 */
  capabilities: string[]
  /** 主机地址 */
  host: string
  /** 端口 */
  port: number
  /** 最后心跳时间（ms） */
  lastHeartbeat: number
  /** 节点启动时间 */
  startedAt: number
  /** 元数据 */
  metadata?: {
    version?: string
    region?: string
    label?: string
  }
}

export function createNode(
  nodeId: string,
  name: string,
  host: string,
  port: number,
  capabilities?: string[],
): ClusterNode {
  return {
    nodeId,
    name,
    status: 'alive',
    load: 0,
    capacity: 100,
    activeTasks: 0,
    capabilities: capabilities || [],
    host,
    port,
    lastHeartbeat: Date.now(),
    startedAt: Date.now(),
  }
}
