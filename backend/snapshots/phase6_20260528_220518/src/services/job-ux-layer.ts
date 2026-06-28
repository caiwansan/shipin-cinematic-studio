/**
 * G3 Job UX Layer — 产品化 Job 体验
 *
 * 把内部 jobId 包装成用户可读的"视频任务"
 * 只暴露友好状态
 */

import { jobQueueManager } from './job-queue-manager.js'

export interface VideoJobUI {
  id: string
  title: string
  stage: 'preparing' | 'generating_characters' | 'generating_scenes' | 'storyboarding' | 'rendering_video' | 'completed' | 'failed'
  progress: number  // 0-100
  estimatedRemaining: string
  resultUrl?: string
  error?: string
  createdAt: number
}

export class JobUXLayer {
  /**
   * 将内部 Job 转为用户友好视图
   */
  async getJobUI(jobId: string): Promise<VideoJobUI | null> {
    const job = jobQueueManager.getStatus(jobId)
    if (!job) return null

    const { stage, progress } = this.mapStatus(job.status, job.type)
    const estimated = this.estimateTime(job.type)

    return {
      id: job.id,
      title: this.getTitle(job.type),
      stage,
      progress,
      estimatedRemaining: estimated,
      resultUrl: job.result?.url,
      error: this.friendlyError(job.error),
      createdAt: job.createdAt,
    }
  }

  private mapStatus(status: string, type: string): { stage: VideoJobUI['stage']; progress: number } {
    switch (status) {
      case 'pending':
        return { stage: 'preparing', progress: 5 }
      case 'running':
        if (type === 'video_generation') return { stage: 'rendering_video', progress: 45 }
        if (type === 'optimization') return { stage: 'generating_scenes', progress: 30 }
        return { stage: 'generating_characters', progress: 15 }
      case 'completed':
        return { stage: 'completed', progress: 100 }
      case 'failed':
        return { stage: 'failed', progress: 0 }
      default:
        return { stage: 'preparing', progress: 0 }
    }
  }

  private getTitle(type: string): string {
    const titles: Record<string, string> = {
      video_generation: '视频生成',
      optimization: '内容优化',
      ai_invoke: 'AI 处理',
    }
    return titles[type] || '任务处理中'
  }

  private estimateTime(type: string): string {
    const times: Record<string, string> = {
      video_generation: '约 30-60 秒',
      optimization: '约 10-20 秒',
      ai_invoke: '约 5-10 秒',
    }
    return times[type] || '计算中...'
  }

  private friendlyError(error?: string): string | undefined {
    if (!error) return undefined
    if (error.includes('timeout')) return '处理超时，请重试'
    if (error.includes('rate limit')) return '请求过于频繁，请稍后再试'
    if (error.includes('API key')) return 'API 密钥配置有误'
    return '生成失败，请重试'
  }
}

export const jobUXLayer = new JobUXLayer()
