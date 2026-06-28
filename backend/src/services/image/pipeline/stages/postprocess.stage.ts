// ============================================================
// PostProcess Stage — 后处理（COS 上传）
//
// Retry Scope: 否（失败不重试，降级为本地 URL）
// 职责：将生成的图片上传到 COS，返回可公开访问的 URL
// ============================================================

import type { PipelineStage, PollOutput, PostProcessOutput, ExecutionContext } from '../types.js'

async function uploadToCOS(imageUrl: string, userId: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('http')) return imageUrl

  try {
    const { cosService } = await import('../../../../services/cos-service.js')
    const result = await cosService.uploadFile(imageUrl, 'image', userId)
    if (result.cosUrl) {
      console.log(`[PostProcess] COS uploaded: ${result.cosUrl.substring(0, 80)}`)
      return result.cosUrl
    }
  } catch (e: any) {
    console.warn(`[PostProcess] COS 上传失败，使用原始 URL: ${e.message}`)
  }

  return imageUrl
}

export function createPostProcessStage(userId: string): PipelineStage<PollOutput, PostProcessOutput> {
  return {
    name: 'postprocess',
    async execute(input: PollOutput, _ctx: ExecutionContext): Promise<PostProcessOutput> {
      const finalUrl = await uploadToCOS(input.imageUrl, userId)
      return {
        taskId: input.taskId,
        imageUrl: finalUrl,
        duration: input.duration,
      }
    },
  }
}
