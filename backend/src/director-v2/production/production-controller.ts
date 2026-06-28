/**
 * production-controller.ts — Phase 6E: Production Binding Layer
 *
 * 把 Director OS 从"可控生成系统"升级为"可调度视频生产系统"。
 *
 * 核心能力：
 *   - Job Queue（生产调度 + 重试 + 生命周期）
 *   - Shot Orchestration（多镜头依赖图 + batch）
 *   - Failure Recovery（partial rerender / backend fallback）
 *   - Production Policy（约束 + 安全检查）
 *
 * 设计原则：
 *   - 每个 job 独立状态，不阻塞其他 job
 *   - 失败按 shot 级别隔离，不整个重来
 *   - backend fallback 自动降级
 */

// ============================================================
// Types
// ============================================================

export type JobStatus = 'queued' | 'running' | 'partial' | 'completed' | 'failed'

export interface RenderJob {
  jobId: string
  sessionId: string
  projectTitle: string

  /** 每个 shot 的执行单元 */
  shots: ShotExecutionUnit[]

  /** 选择的 backend */
  backend: string

  status: JobStatus
  retries: number
  maxRetries: number

  /** 失败记录 */
  failures: ShotFailure[]

  createdAt: number
  updatedAt: number
}

export interface ShotExecutionUnit {
  shotId: string
  index: number
  sceneId: string

  /** 依赖的前序 shotId（有顺序依赖时才渲染） */
  dependencies: string[]

  status: 'pending' | 'running' | 'completed' | 'failed'

  /** 生成的视频片段标识 */
  outputClipId: string | null

  /** 失败次数 */
  retries: number

  /** 依赖的 temporal anchor */
  temporalAnchor: TemporalAnchorSnapshot | null
}

export interface TemporalAnchorSnapshot {
  identityCharacters: string[]
  sceneLocation: string
  cameraMotion: string
  lightingState: string
}

export interface ShotFailure {
  shotId: string
  error: string
  retryCount: number
  fallbackUsed: boolean
}

// ============================================================
// RenderJob — 生产 job 创建
// ============================================================

export interface ProductionOutput {
  jobId: string
  totalShots: number
  completedShots: number
  failedShots: number
  status: JobStatus
}

// ============================================================
// Job Queue
// ============================================================

class JobQueue {
  private queue: RenderJob[] = []
  private active: Map<string, RenderJob> = new Map()
  private completed: Map<string, RenderJob> = new Map()

  enqueue(job: RenderJob): void {
    this.queue.push(job)
  }

  dequeue(): RenderJob | null {
    // 先拿依赖已满足的
    const idx = this.queue.findIndex(job => this.dependenciesMet(job))
    if (idx === -1) return null
    const job = this.queue.splice(idx, 1)[0]
    this.active.set(job.jobId, job)
    return job
  }

  complete(job: RenderJob): void {
    this.active.delete(job.jobId)
    this.completed.set(job.jobId, job)
  }

  size(): { queued: number; active: number; completed: number } {
    return {
      queued: this.queue.length,
      active: this.active.size,
      completed: this.completed.size,
    }
  }

  getJob(jobId: string): RenderJob | undefined {
    return this.queue.find(j => j.jobId === jobId)
      || this.active.get(jobId)
      || this.completed.get(jobId)
  }

  private dependenciesMet(job: RenderJob): boolean {
    // 所有依赖的 shot 必须在已完成的 job 中
    for (const shot of job.shots) {
      for (const dep of shot.dependencies) {
        const depShot = job.shots.find(s => s.shotId === dep)
        if (depShot && depShot.status !== 'completed') return false
      }
    }
    return true
  }
}

// ============================================================
// Shot Orchestrator
// ============================================================

export class ShotOrchestrator {
  /**
   * 从 ExecutionPlan + temporal graph 构建 ShotExecutionUnit 列表
   * 自动推导 shot 间的依赖顺序
   */
  orchestrate(
    plan: { scenes: Array<{ sceneId: string; shots: Array<{ shotId: string }> }> },
    temporalEdges?: Array<{ fromShotId: string; toShotId: string; continuityType: string }>,
    anchors?: { characters: string[]; locations: string[] },
  ): ShotExecutionUnit[] {
    const units: ShotExecutionUnit[] = []
    let globalIndex = 0

    // 构建依赖图
    const dependencyGraph = new Map<string, Set<string>>()
    if (temporalEdges) {
      for (const edge of temporalEdges) {
        if (edge.continuityType === 'direct_continuation') {
          if (!dependencyGraph.has(edge.toShotId)) {
            dependencyGraph.set(edge.toShotId, new Set())
          }
          dependencyGraph.get(edge.toShotId)!.add(edge.fromShotId)
        }
      }
    }

    for (const scene of plan.scenes) {
      let lastLocation = ''
      for (const shot of scene.shots) {
        const deps = Array.from(dependencyGraph.get(shot.shotId) || [])
        const anchor = this.buildAnchor(shot, anchors, lastLocation)

        units.push({
          shotId: shot.shotId,
          index: globalIndex,
          sceneId: scene.sceneId,
          dependencies: deps,
          status: 'pending',
          outputClipId: null,
          retries: 0,
          temporalAnchor: anchor,
        })

        lastLocation = anchor.sceneLocation
        globalIndex++
      }
    }

    return units
  }

  private buildAnchor(
    shot: { shotId: string },
    anchors?: { characters: string[]; locations: string[] },
    lastLocation?: string,
  ): TemporalAnchorSnapshot {
    const locIdx = parseInt(shot.shotId.replace(/\D/g, '')) || 0
    return {
      identityCharacters: anchors?.characters || [],
      sceneLocation: (anchors?.locations && anchors.locations[locIdx % anchors.locations.length]) || lastLocation || 'generic',
      cameraMotion: 'tracked',
      lightingState: 'continuous',
    }
  }
}

// ============================================================
// Failure Recovery
// ============================================================

export class FailureRecovery {
  /**
   * 决定失败时的恢复策略
   */
  recover(job: RenderJob, failedShotId: string, error: string): RecoveryAction {
    const shot = job.shots.find(s => s.shotId === failedShotId)
    if (!shot) return { action: 'abort', reason: 'shot not found' }

    shot.retries++

    job.failures.push({
      shotId: failedShotId,
      error,
      retryCount: shot.retries,
      fallbackUsed: false, // 在 fallback action 中设为 true
    })

    // 先尝试 retry
    if (shot.retries <= job.maxRetries) {
      const hasDependents = job.shots.some(s => s.dependencies.includes(failedShotId))
      return {
        action: hasDependents ? 'partial_rerender' : 'retry_shot',
        reason: `retry ${shot.retries}/${job.maxRetries} for ${failedShotId}`,
      }
    }

    // 超出最大重试 → 尝试 backend fallback（仅一次）
    const alreadyFellBack = job.failures.filter(f => f.shotId === failedShotId).some(f => f.fallbackUsed)
    if (!alreadyFellBack && shot.retries === job.maxRetries + 1) {
      shot.status = 'pending' // reset for fallback
      // Mark the most recent failure as fallback
      const last = job.failures[job.failures.length - 1]
      if (last) last.fallbackUsed = true
      return {
        action: 'fallback_backend',
        fallbackBackend: 'pika',
        reason: `shot ${failedShotId} fallback after ${shot.retries - 1} retries`,
      }
    }

    // fallback 也失败了
    return { action: 'skip_shot', reason: `shot ${failedShotId} max retries + fallback exceeded` }
  }
}

export type RecoveryAction =
  | { action: 'retry_shot'; reason: string }
  | { action: 'partial_rerender'; reason: string }
  | { action: 'fallback_backend'; fallbackBackend: string; reason: string }
  | { action: 'skip_shot'; reason: string }
  | { action: 'abort'; reason: string }

// ============================================================
// Production Controller
// ============================================================

export class ProductionController {
  private queue = new JobQueue()
  private orchestrator = new ShotOrchestrator()
  private recovery = new FailureRecovery()

  /**
   * 提交一个生产 job
   */
  submit(
    sessionId: string,
    projectTitle: string,
    plan: { scenes: Array<{ sceneId: string; shots: Array<{ shotId: string }> }> },
    backend: string,
    temporalEdges?: Array<{ fromShotId: string; toShotId: string; continuityType: string }>,
    anchors?: { characters: string[]; locations: string[] },
  ): string {
    const shots = this.orchestrator.orchestrate(plan, temporalEdges, anchors)
    const job: RenderJob = {
      jobId: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
      projectTitle,
      shots,
      backend,
      status: 'queued',
      retries: 0,
      maxRetries: 3,
      failures: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.queue.enqueue(job)
    return job.jobId
  }

  /**
   * 处理下一个 job（模拟 worker tick）
   */
  processNext(): ProductionOutput | null {
    const job = this.queue.dequeue()
    if (!job) return null

    job.status = 'running'
    job.updatedAt = Date.now()

    // 模拟执行每个 shot
    for (const shot of job.shots) {
      shot.status = 'running'

      // 模拟执行（真实场景这里调 backend API）
      const success = this.simulateRender(shot.shotId)
      if (success) {
        shot.status = 'completed'
        shot.outputClipId = `clip_${job.jobId}_${shot.shotId}`
      } else {
        const action = this.recovery.recover(job, shot.shotId, 'simulated failure')
        if (action.action === 'retry_shot' || action.action === 'partial_rerender') {
          shot.status = 'completed' // 模拟重试成功
          shot.outputClipId = `clip_${job.jobId}_${shot.shotId}_retry`
        } else {
          shot.status = 'failed'
        }
      }
    }

    // 更新 job 状态
    const completedCount = job.shots.filter(s => s.status === 'completed').length
    const failedCount = job.shots.filter(s => s.status === 'failed').length

    if (failedCount === 0) {
      job.status = 'completed'
    } else if (completedCount > 0) {
      job.status = 'partial'
    } else {
      job.status = 'failed'
    }

    job.updatedAt = Date.now()
    this.queue.complete(job)

    return {
      jobId: job.jobId,
      totalShots: job.shots.length,
      completedShots: completedCount,
      failedShots: failedCount,
      status: job.status,
    }
  }

  /**
   * 获取 job 状态
   */
  getStatus(jobId: string): RenderJob | null {
    return this.queue.getJob(jobId) || null
  }

  /**
   * 队列状态
   */
  getQueueStatus() {
    return this.queue.size()
  }

  getShotOrchestrator(): ShotOrchestrator {
    return this.orchestrator
  }

  getFailureRecovery(): FailureRecovery {
    return this.recovery
  }

  private simulateRender(_shotId: string): boolean {
    // 75% 成功率模拟
    return Math.random() > 0.25
  }
}

// ============================================================
// Production Policy
// ============================================================

export const PRODUCTION_POLICY = {
  allowPartialRender: true,
  maxRetries: 3,
  fallbackBackend: 'pika',
  forbiddenActions: [
    'direct_ir_execution',
    'unbatched_render',
    'state_mutation_without_job',
  ] as readonly string[],
}

/** 全局单例 */
export const productionController = new ProductionController()
