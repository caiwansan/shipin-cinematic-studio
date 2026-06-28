/**
 * E3 Video Pipeline — 异步版
 *
 * API 层提交 Job → Worker 执行 → 结果可查询
 */

import { jobQueueManager } from '../services/job-queue-manager.js'
import { workerPool } from '../workers/worker-pool.js'
import { videoPipelineEngine } from '../services/video-pipeline.engine.js'
import { optimizationEngine } from '../services/optimization-engine.js'

export class AsyncPipelineService {
  /**
   * 异步提交视频生成任务
   */
  async submitVideoGeneration(projectId: string): Promise<string> {
    return jobQueueManager.wrapAsync('video_generation', async () => {
      const result = await videoPipelineEngine.generate({ projectId, userId: 'system' })
      return result
    })
  }

  /**
   * 异步提交优化任务
   */
  async submitOptimization(params: {
    assetRegistryId: string
    userId: string
    projectId: string
    agentType: 'character_agent' | 'scene_agent' | 'storyboard_agent' | 'optimization_agent'
    optimizationTarget?: string
  }): Promise<string> {
    return jobQueueManager.wrapAsync('optimization', async () => {
      const result = await optimizationEngine.optimize(params)
      return result
    })
  }

  /**
   * 初始化 Worker Pool，注册处理器
   */
  initWorkers() {
    // 视频生成处理器
    workerPool.registerHandler('video_generation', async (job) => {
      const { projectId } = job.payload
      return videoPipelineEngine.generate({ projectId, userId: 'system' })
    })

    // AI 调用处理器
    workerPool.registerHandler('ai_invoke', async (job) => {
      const { gateway, params } = job.payload
      const { UnifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      const gw = gateway ? new (UnifiedAIGateway as any)() : undefined
      return gw?.invokeAI(params)
    })

    // 优化任务处理器
    workerPool.registerHandler('optimization', async (job) => {
      const { OptimizationEngine } = await import('../services/optimization-engine.js')
      const engine = new (OptimizationEngine as any)()
      return engine.optimize(job.payload)
    })

    workerPool.start(500)
  }
}

export const asyncPipelineService = new AsyncPipelineService()
