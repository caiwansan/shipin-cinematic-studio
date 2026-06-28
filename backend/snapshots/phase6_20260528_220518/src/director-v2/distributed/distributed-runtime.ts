/**
 * distributed-runtime.ts — Phase 6F: Distributed Video Runtime Layer
 *
 * 把 Production Binding Layer 从"单机执行"升级为"分布式视频生产"。
 *
 * 核心抽象：
 *   - WorkerNode — 抽象渲染节点（可代表 GPU worker / container / remote API）
 *   - ClusterManager — 节点注册 + 发现 + 负载聚合
 *   - JobSharder — 按 shot/时间窗口 分片
 *   - ParallelExecutor — 并发分派 + 结果收集
 *   - StreamComposer — 有序流拼接
 *   - FaultToleranceMesh — 节点级故障转移
 *   - LoadBalancer — 最小负载优先
 */

// ============================================================
// Worker Node Abstraction
// ============================================================

export interface WorkerCapability {
  /** 支持的 backend 类型 */
  backends: string[]
  maxResolution: string
  maxFPS: number
}

export interface WorkerNode {
  id: string
  status: 'idle' | 'busy' | 'offline'
  capability: WorkerCapability
  /** 当前负载 (0-1) */
  load: number
  /** 上次心跳 */
  lastHeartbeat: number
}

// ============================================================
// Job Shard
// ============================================================

export interface JobShard {
  shardId: string
  jobId: string
  /** 该 shard 负责的 shotIds */
  shotIds: string[]
  /** 依赖的前序 shardId */
  dependsOn: string | null
  /** 该 shard 的连续性约束（用于有序拼接） */
  continuationKey: string
  /** 选择的 backend */
  backend: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** 分配的 worker */
  assignedWorker: string | null
}

export interface ShardResult {
  shardId: string
  shotIds: string[]
  clipId: string
  frameCount: number
  duration: number
  workerId: string
}

// ============================================================
// Cluster Manager
// ============================================================

export class ClusterManager {
  private nodes: Map<string, WorkerNode> = new Map()

  register(node: WorkerNode): void {
    this.nodes.set(node.id, { ...node, lastHeartbeat: Date.now() })
  }

  unregister(nodeId: string): void {
    this.nodes.delete(nodeId)
  }

  getNode(nodeId: string): WorkerNode | undefined {
    return this.nodes.get(nodeId)
  }

  /** 获取空闲且支持指定 backend 的节点 */
  getIdleNode(backend: string): WorkerNode | undefined {
    return Array.from(this.nodes.values()).find(
      n => n.status === 'idle' && n.capability.backends.includes(backend),
    )
  }

  /** 标记节点离线 */
  markOffline(nodeId: string): void {
    const node = this.nodes.get(nodeId)
    if (node) node.status = 'offline'
  }

  /** 更新节点负载 */
  updateLoad(nodeId: string, load: number): void {
    const node = this.nodes.get(nodeId)
    if (node) {
      node.load = load
      node.lastHeartbeat = Date.now()
    }
  }

  /** 获取集群状态快照 */
  getSnapshot(): ClusterSnapshot {
    const all = Array.from(this.nodes.values())
    return {
      totalNodes: all.length,
      idleNodes: all.filter(n => n.status === 'idle').length,
      busyNodes: all.filter(n => n.status === 'busy').length,
      offlineNodes: all.filter(n => n.status === 'offline').length,
      averageLoad: all.length > 0 ? all.reduce((s, n) => s + n.load, 0) / all.length : 0,
      backends: [...new Set(all.flatMap(n => n.capability.backends))],
    }
  }
}

export interface ClusterSnapshot {
  totalNodes: number
  idleNodes: number
  busyNodes: number
  offlineNodes: number
  averageLoad: number
  backends: string[]
}

// ============================================================
// Job Sharder
// ============================================================

export class JobSharder {
  /**
   * 将 production job 拆分为可并行执行的分片
   * 分片策略：同一场景内的 shot 尽量分到一起，跨场景的按边界切分
   */
  shard(
    jobId: string,
    shots: Array<{ shotId: string; sceneId: string; dependencies: string[] }>,
    maxShardSize: number = 3,
  ): JobShard[] {
    const shards: JobShard[] = []
    let currentShard: JobShard | null = null

    for (const shot of shots) {
      // 跨场景或当前 shard 已满 → new shard
      if (!currentShard || currentShard.shotIds.length >= maxShardSize || this.isSceneBoundary(shot, shots)) {
        if (currentShard) shards.push(currentShard)

        currentShard = {
          shardId: `shard_${jobId}_${shards.length}`,
          jobId,
          shotIds: [shot.shotId],
          dependsOn: shards.length > 0 ? shards[shards.length - 1].shardId : null,
          continuationKey: shot.sceneId,
          backend: 'runway', // default, overridden by executor
          status: 'pending',
          assignedWorker: null,
        }
      } else {
        // 追加到当前 shard
        currentShard.shotIds.push(shot.shotId)
        // 更新 continuation key
        if (shot.sceneId !== currentShard.continuationKey) {
          currentShard.continuationKey = `${currentShard.continuationKey}→${shot.sceneId}`
        }
      }
    }

    // 最后一块
    if (currentShard) shards.push(currentShard)

    return shards
  }

  private isSceneBoundary(shot: { shotId: string; sceneId: string }, allShots: Array<{ sceneId: string }>): boolean {
    const idx = allShots.indexOf(shot)
    if (idx > 0) {
      return allShots[idx - 1].sceneId !== shot.sceneId
    }
    return false
  }
}

// ============================================================
// Load Balancer
// ============================================================

export class LoadBalancer {
  /** 按负载排序（最小优先），过滤指定 backend */
  selectNode(nodes: WorkerNode[], backend: string): WorkerNode | null {
    const candidates = nodes
      .filter(n => n.status === 'idle' && n.capability.backends.includes(backend))
      .sort((a, b) => a.load - b.load)

    return candidates[0] || null
  }
}

// ============================================================
// Parallel Executor
// ============================================================

export class ParallelExecutor {
  /**
   * 并行执行一组 shard（按依赖顺序分批次）
   * 同一批次内的 shard 可并行，批次间串行（按依赖）
   */
  async execute(
    shards: JobShard[],
    cluster: ClusterManager,
    balancer: LoadBalancer,
    renderFn: (shard: JobShard, worker: WorkerNode) => Promise<ShardResult>,
  ): Promise<{ results: ShardResult[]; failedShards: JobShard[] }> {
    const results: ShardResult[] = []
    const failedShards: JobShard[] = []
    const completed = new Set<string>()
    const failedSet = new Set<string>()

    while (completed.size + failedSet.size < shards.length) {
      // 每一轮重建批次（包含已识别的失败）
      const batch = shards.filter(shard => {
        if (completed.has(shard.shardId) || failedSet.has(shard.shardId)) return false
        // 无依赖 或 依赖已完成 → 可执行
        if (!shard.dependsOn || completed.has(shard.dependsOn)) return true
        // 依赖已失败 → 也排入（但执行时会失败）
        if (failedSet.has(shard.dependsOn)) return true
        return false
      })

      if (batch.length === 0) break // deadlock prevention

      // 并行执行该批次
      const batchPromises = batch.map(async (shard) => {
        const worker = balancer.selectNode(
          Array.from(cluster['nodes'].values()) as WorkerNode[],
          shard.backend,
        )

        if (!worker) {
          shard.status = 'failed'
          failedSet.add(shard.shardId)
          failedShards.push(shard)
          return null
        }

        try {
          shard.assignedWorker = worker.id
          shard.status = 'running'
          cluster.updateLoad(worker.id, worker.load + 0.3)

          const result = await renderFn(shard, worker)

          shard.status = 'completed'
          cluster.updateLoad(worker.id, Math.max(0, worker.load - 0.3))
          completed.add(shard.shardId)
          results.push(result)
          return result
        } catch {
          shard.status = 'failed'
          cluster.updateLoad(worker.id, Math.max(0, worker.load - 0.3))
          failedSet.add(shard.shardId)
          failedShards.push(shard)
          return null
        }
      })

      await Promise.all(batchPromises)
    }

    return { results, failedShards }
  }
}

// ============================================================
// Stream Composer
// ============================================================

export class StreamComposer {
  /**
   * 按 shard 依赖顺序拼接结果流
   */
  compose(results: ShardResult[], shards: JobShard[]): ComposedStream {
    // 按依赖顺序排序
    const shardMap = new Map(shards.map(s => [s.shardId, s]))
    const ordered = this.topologicalSort(shards)

    const clips = ordered
      .filter(s => s.status === 'completed')
      .map(s => {
        const result = results.find(r => r.shardId === s.shardId)
        return result ? {
          clipId: result.clipId,
          shotIds: s.shotIds,
          shardId: s.shardId,
          frameCount: result.frameCount,
          continuationKey: s.continuationKey,
        } : null
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    const totalFrames = clips.reduce((s, c) => s + c.frameCount, 0)
    const failedShardIds = shards.filter(s => s.status === 'failed').map(s => s.shardId)

    return {
      streamId: `stream_${Date.now()}`,
      clips,
      totalFrames,
      totalClips: clips.length,
      failedShardIds,
      hasGaps: failedShardIds.length > 0,
    }
  }

  private topologicalSort(shards: JobShard[]): JobShard[] {
    const sorted: JobShard[] = []
    const visited = new Set<string>()

    const visit = (shard: JobShard) => {
      if (visited.has(shard.shardId)) return
      visited.add(shard.shardId)
      if (shard.dependsOn) {
        const dep = shards.find(s => s.shardId === shard.dependsOn)
        if (dep) visit(dep)
      }
      sorted.push(shard)
    }

    for (const shard of shards) visit(shard)
    return sorted
  }
}

export interface ComposedStream {
  streamId: string
  clips: Array<{
    clipId: string
    shotIds: string[]
    shardId: string
    frameCount: number
    continuationKey: string
  }>
  totalFrames: number
  totalClips: number
  failedShardIds: string[]
  hasGaps: boolean
}

// ============================================================
// Fault Tolerance Mesh
// ============================================================

export class FaultToleranceMesh {
  /**
   * 处理节点故障 — 尝试 reassign 失败的 shard
   */
  handleNodeFailure(
    failedNodeId: string,
    activeShards: JobShard[],
    cluster: ClusterManager,
  ): ReassignResult {
    cluster.markOffline(failedNodeId)

    const affectedShards = activeShards.filter(s => s.assignedWorker === failedNodeId)
    const reassignments: JobShard[] = []

    for (const shard of affectedShards) {
      const node = cluster.getIdleNode(shard.backend)
      if (node) {
        shard.assignedWorker = node.id
        shard.status = 'running'
        reassignments.push(shard)
      } else {
        shard.status = 'failed'
      }
    }

    return {
      failedNodeId,
      affectedShards: affectedShards.length,
      reassignedShards: reassignments.length,
      lostShards: affectedShards.length - reassignments.length,
      message: `Node ${failedNodeId} failed: ${reassignments.length}/${affectedShards.length} shards reassigned`,
    }
  }
}

export interface ReassignResult {
  failedNodeId: string
  affectedShards: number
  reassignedShards: number
  lostShards: number
  message: string
}

// ============================================================
// Distributed Controller
// ============================================================

export class DistributedController {
  cluster = new ClusterManager()
  sharder = new JobSharder()
  balancer = new LoadBalancer()
  executor = new ParallelExecutor()
  composer = new StreamComposer()
  faultMesh = new FaultToleranceMesh()

  /**
   * 注册一个 worker 节点
   */
  registerWorker(node: WorkerNode): void {
    this.cluster.register(node)
  }

  /**
   * 提交并执行一个分布式渲染 job
   */
  async render(
    jobId: string,
    shots: Array<{ shotId: string; sceneId: string; dependencies: string[] }>,
    maxShardSize: number = 3,
    renderFn: (shard: JobShard, worker: WorkerNode) => Promise<ShardResult>,
  ): Promise<DistributedRenderResult> {
    const shards = this.sharder.shard(jobId, shots, maxShardSize)

    const { results, failedShards } = await this.executor.execute(shards, this.cluster, this.balancer, renderFn)

    const stream = this.composer.compose(results, shards)

    return {
      jobId,
      totalShards: shards.length,
      completedShards: results.length,
      failedShards: failedShards.length,
      stream,
      cluster: this.cluster.getSnapshot(),
    }
  }

  /**
   * 处理节点故障
   */
  recoverNode(failedNodeId: string): ReassignResult {
    return this.faultMesh.handleNodeFailure(failedNodeId, [], this.cluster)
  }
}

export interface DistributedRenderResult {
  jobId: string
  totalShards: number
  completedShards: number
  failedShards: number
  stream: ComposedStream
  cluster: ClusterSnapshot
}

/** 全局单例 */
export const distributedController = new DistributedController()
