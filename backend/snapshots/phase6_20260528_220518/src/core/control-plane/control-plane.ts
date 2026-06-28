/**
 * P2 — Execution Control Plane（执行控制层）
 *
 * ═══ 宪法 ═══
 * ControlPlane 是所有 AI 执行的唯一入口。
 * 任何任务必须经过 ControlPlane 调度，禁止绕过。
 *
 * ═══ 调用链 ═══
 * API Layer → ControlPlane.execute()
 *   → Backpressure.check()           ← 限流检查
 *   → ExecutionQueue.enqueue()       ← 入队
 *   → Scheduler.dispatch()           ← 调度
 *   → WorkerPool.acquire()           ← 获取 Worker
 *   → Adapter.execute()              ← 真正的 AI 调用（P1 Adapter Layer）
 *
 * @see runtime-dispatcher.ts (P1) — 原始入口，现在由 ControlPlane 接管
 */

import { Capability } from '../../core/runtime/capabilities.js'
import { ExecutionQueue } from './queue/execution-queue.js'
import { Scheduler } from './scheduler/scheduler.js'
import { WorkerPool } from './worker-pool/worker-pool.js'
import { Backpressure } from './backpressure/backpressure.js'
import { createExecutionContext } from './isolation/execution-context.js'

class ControlPlane {
  private queue!: ExecutionQueue
  private scheduler!: Scheduler
  private workerPool!: WorkerPool
  private backpressure!: Backpressure
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return
    this.queue = new ExecutionQueue()
    this.scheduler = new Scheduler()
    this.workerPool = new WorkerPool()
    this.backpressure = new Backpressure()
    this.initialized = true
    console.log('[ControlPlane] ✅ 初始化完成 (queue + scheduler + workerPool + backpressure)')
  }

  async execute(task: {
    capability: Capability
    userId: string
    payload: any
    providerConfig?: any  // P1 显式 provider config
    priority?: number
  }): Promise<{
    success: boolean
    data?: any
    error?: string
    requestId?: string
    latency?: number
  }> {
    const start = Date.now()

    if (!this.initialized) {
      await this.init()
    }

    // 1. 创建隔离执行上下文
    const ctx = createExecutionContext(task)

    // 2. 限流检查
    const canProceed = this.backpressure.check({
      userId: task.userId,
      capability: task.capability,
      requestId: ctx.requestId,
    })

    if (!canProceed.allowed) {
      return {
        success: false,
        error: `backpressure blocked: ${canProceed.reason}`,
        requestId: ctx.requestId,
        latency: Date.now() - start,
      }
    }

    // 3. 入队
    const job = await this.queue.enqueue({
      requestId: ctx.requestId,
      capability: task.capability,
      userId: task.userId,
      payload: task.payload,
      providerConfig: task.providerConfig,
      priority: task.priority || 0,
      timeout: ctx.timeout,
      createdAt: Date.now(),
    })

    // 4. 调度
    const scheduled = await this.scheduler.dispatch(job)

    // 5. 从 Worker Pool 获取 Worker 并执行
    const worker = await this.workerPool.acquire(scheduled.capability)

    try {
      const result = await worker.run({
        capability: scheduled.capability,
        userId: scheduled.userId,
        providerConfig: task.providerConfig,
        payload: scheduled.payload,
        signal: ctx.abortController.signal,
        timeout: ctx.timeout,
      })

      return {
        success: true,
        data: result,
        requestId: ctx.requestId,
        latency: Date.now() - start,
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'execution failed',
        requestId: ctx.requestId,
        latency: Date.now() - start,
      }
    }
  }

  // 简化版：兼容 sync 场景（无需完整 queue/worker pool 的开销）
  async executeSync(task: {
    capability: Capability
    userId: string
    payload: any
    providerConfig?: any
  }): Promise<any> {
    if (!this.initialized) {
      await this.init()
    }

    const ctx = createExecutionContext(task)

    const canProceed = this.backpressure.check({
      userId: task.userId,
      capability: task.capability,
      requestId: ctx.requestId,
    })
    if (!canProceed.allowed) {
      throw new Error(`backpressure blocked: ${canProceed.reason}`)
    }

    // 如果未传 providerConfig，自动从用户的模型配置读取
    let providerConfig = task.providerConfig
    if (!providerConfig?.apiKey) {
      try {
        const { prisma } = await import('../../utils/index.js')
        // 优先 V2（单行配置）
        const v2 = await (prisma as any).userModelConfigV2?.findUnique?.({ where: { userId: task.userId } })
        if (v2?.config?.llmConfig?.apiKey) {
          providerConfig = {
            apiKey: v2.config.llmConfig.apiKey,
            modelName: v2.config.llmConfig.modelName || 'deepseek-chat',
            baseUrl: v2.config.llmConfig.baseUrl || 'https://api.deepseek.com',
            provider: v2.config.llmConfig.provider,
          }
        } else {
          // 降级 V1：遍历用户的模型配置，找 LLM provider（deepseek/siliconflow）
          const v1Rows = await (prisma as any).userModelConfig.findMany?.({ where: { userId: task.userId } })
          if (v1Rows?.length) {
            // 找到第一个 LLM type 的配置（deepseek / siliconflow）
            const llmConfig = v1Rows.find((r: any) => r.provider === 'deepseek' || r.provider === 'siliconflow')
            if (llmConfig?.apiKey) {
              providerConfig = {
                apiKey: llmConfig.apiKey,
                modelName: llmConfig.modelName || 'deepseek-chat',
                baseUrl: llmConfig.baseUrl || 'https://api.deepseek.com',
                provider: llmConfig.provider,
              }
              console.log(`[ControlPlane] 使用用户 V1 配置: provider=${llmConfig.provider}`)
            }
          }
        }
      } catch (e) {
        console.warn(`[ControlPlane] ⚠️ 读取用户模型配置失败: ${(e as any)?.message}`)
      }
    }
    // 兜底：环境变量（仅开发调试用）
    if (!providerConfig?.apiKey) {
      if (process.env.LLM_BASE_URL && process.env.VOLCENGINE_API_KEY) {
        providerConfig = {
          apiKey: process.env.VOLCENGINE_API_KEY,
          modelName: process.env.VOLCENGINE_LLM_MODEL || process.env.LLM_MODEL || 'doubao-seed-2-0-mini-260428',
          baseUrl: process.env.LLM_BASE_URL,
        }
        console.log('[ControlPlane] ⚠️ 使用环境变量 VOLCENGINE_API_KEY（未找到用户配置）')
      } else if (process.env.DEEPSEEK_API_KEY) {
        providerConfig = {
          apiKey: process.env.DEEPSEEK_API_KEY,
          modelName: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
          baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        }
        console.log('[ControlPlane] ⚠️ 使用环境变量 DEEPSEEK_API_KEY（未找到用户配置）')
      }
    }

    const worker = await this.workerPool.acquire(task.capability)
    return worker.run({
      capability: task.capability,
      userId: task.userId,
      providerConfig,
      payload: task.payload,
      signal: ctx.abortController.signal,
      timeout: ctx.timeout,
    })
  }
}

export const controlPlane = new ControlPlane()
