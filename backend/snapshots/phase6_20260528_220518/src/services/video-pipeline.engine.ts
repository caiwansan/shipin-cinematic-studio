/**
 * D2-3/D2-4 Video Pipeline — 视频生成 + 组装流水线
 *
 * ShotPlan → 逐镜头调 AI Gateway → 生成视频段 → 组装
 *
 * 当前为编排层，实际视频生成调用 aliyun-video provider
 */

import { shotResolver, ShotPlan, Shot } from './shot-resolver.service.js'
import { unifiedAIGateway } from './unified-ai-gateway.js'
import { assetVersionService } from './asset-version.service.js'
import { prisma } from '../utils/index.js'

export interface VideoSegment {
  shotIndex: number
  assetId: string
  traceId: string
  videoUrl?: string
  status: 'pending' | 'generated' | 'failed'
  error?: string
}

export interface VideoPipelineResult {
  projectId: string
  totalShots: number
  segments: VideoSegment[]
  assemblyUrl?: string
  status: 'completed' | 'partial'
}

export class VideoPipelineEngine {
  /**
   * 执行视频生成流水线
   */
  async generate(params: {
    projectId: string
    userId?: string
  }): Promise<VideoPipelineResult> {
    const { projectId, userId = 'system' } = params

    const plan = await shotResolver.resolveShotPlan(projectId)

    const segments: VideoSegment[] = []

    for (const shot of plan.shots) {
      try {
        const shotPrompt = await shotResolver.buildShotPrompt(shot.shotIndex, projectId)

        // 调用 AI Gateway（图生视频）
        const result = await unifiedAIGateway.invokeAI({
          userId,
          projectId,
          agentType: 'storyboard_agent',
          capability: 'llm',
          input: {
            messages: [
              {
                role: 'user',
                content: `你是一个视频镜头描述生成器。请根据以下镜头内容生成一个适合传入 wan2.7-video 模型的视频描述提示词，包含场景、角色动作、镜头运动、光影等信息。\n\n${shotPrompt}`,
              },
            ],
          },
          assetRegistryId: shot.assetId,
        })

        let videoUrl: string | undefined
        if (result.status === 'success' && result.output?.content) {
          // 生成视频描述成功——后续由外部 video worker 调用 aliyun-video provider
          videoUrl = `pending:${result.traceId}`
        }

        segments.push({
          shotIndex: shot.shotIndex,
          assetId: shot.assetId,
          traceId: result.traceId,
          videoUrl,
          status: 'generated',
        })
      } catch (err: any) {
        segments.push({
          shotIndex: shot.shotIndex,
          assetId: shot.assetId,
          traceId: '',
          status: 'failed',
          error: err.message,
        })
      }
    }

    const successCount = segments.filter(s => s.status === 'generated').length
    return {
      projectId,
      totalShots: plan.shots.length,
      segments,
      status: successCount === plan.shots.length ? 'completed' : 'partial',
    }
  }

  /**
   * 组装视频段（最终拼接）
   * 生产环境使用 ffmpeg concat
   */
  async assemble(projectId: string): Promise<{ url: string; segments: number }> {
    const segments = await prisma.assetRegistry.findMany({
      where: { projectId, type: 'storyboard' },
      orderBy: { sortOrder: 'asc' },
    })

    // 最终拼接由视频层异步处理
    // 返回元数据供 worker 消费
    return {
      url: `assembly://${projectId}`,
      segments: segments.length,
    }
  }
}

export const videoPipelineEngine = new VideoPipelineEngine()
