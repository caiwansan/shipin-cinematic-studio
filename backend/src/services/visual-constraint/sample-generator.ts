/**
 * Visual Constraint Loop — Phase 1: Multi-Sample Generator
 *
 * 把单次生成变成多采样：
 *   1 prompt → N images (N=2)
 *   seed = baseSeed + index
 *   N 个任务并行发出，互不阻塞
 *
 * 不做 validation，不做 constraint，只做「多样性采样」
 */

import type { ViewCandidate } from './types.js'

export interface SampleGeneratorOptions {
  /**
   * 生成图片数（默认 2）
   */
  sampleCount?: number

  /**
   * 基础 prompt
   */
  prompt: string

  /**
   * 负面 prompt
   */
  negativePrompt: string

  /**
   * 项目 ID
   */
  projectId: string

  /**
   * 角色名
   */
  characterName: string

  /**
   * 基础 seed
   */
  baseSeed: number

  /**
   * 参考图 URL（可选）
   */
  referenceImage?: string

  /**
   * 后端 base URL /api/tasks/ai-generate 的完整地址
   */
  baseApiUrl: string

  /**
   * Authorization header
   */
  authHeader: string
}

/**
 * 生成 N 个样本，并行发出
 * 返回 imageUrl 列表（失败的返回空字符串）
 */
export async function generateImageSamples(
  options: SampleGeneratorOptions,
): Promise<ViewCandidate[]> {
  const {
    sampleCount = 2,
    prompt,
    negativePrompt,
    projectId,
    characterName,
    baseSeed,
    referenceImage,
    baseApiUrl,
    authHeader,
  } = options

  // 并行发出 N 个生成任务
  const tasks = Array.from({ length: sampleCount }, (_, i) => {
    const seed = baseSeed + i * 100  // seed 间隔 100，避免 seed 接近导致同质化
    return submitSingleImage({
      prompt,
      negativePrompt,
      projectId,
      characterName,
      seed,
      referenceImage,
      baseApiUrl,
      authHeader,
    })
  })

  const urls = await Promise.all(tasks)

  return urls.map((url, i) => ({
    url,
    seed: baseSeed + i * 100,
    validation: null,   // 后续由 Vision Validator 填充
    score: 0,            // 后续由 Scoring Engine 填充
  }))
}

/**
 * 单次图片生成调用（复用 submitImageTask 的逻辑）
 * 直接 POST 到 /api/tasks/ai-generate，轮询等待结果
 */
async function submitSingleImage(options: {
  prompt: string
  negativePrompt: string
  projectId: string
  characterName: string
  seed: number
  referenceImage?: string
  baseApiUrl: string
  authHeader: string
}): Promise<string> {
  const {
    prompt,
    negativePrompt,
    projectId,
    characterName,
    seed,
    referenceImage,
    baseApiUrl,
    authHeader,
  } = options

  const taskInput: any = {
    prompt,
    negativePrompt,
    source: 'character_execution',
    characterName,
    name: characterName,
    seed,
  }

  if (referenceImage) {
    taskInput.referenceImage = referenceImage
    taskInput.referenceImages = [referenceImage]
  }

  try {
    const genRes = await fetch(`${baseApiUrl}/api/tasks/ai-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: authHeader },
      body: JSON.stringify({ projectId, taskType: 'image', input: taskInput }),
    })

    if (!genRes.ok) {
      const errText = await genRes.text().catch(() => '')
      console.warn(`[SampleGenerator] 提交失败: ${genRes.status} ${errText}`)
      return ''
    }

    const genData = await genRes.json() as any
    const taskId = genData?.task?.id
    if (!taskId) return ''

    // 轮询等待（最多 60 秒，每 2 秒检查一次）
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes = await fetch(`${baseApiUrl}/api/tasks/${taskId}/status`, {
        headers: { authorization: authHeader },
      })
      if (!statusRes.ok) continue
      const statusData = await statusRes.json() as any
      const task = statusData?.task
      if (!task) continue

      if (task.status === 'completed') {
        const result = task.result || {}
        return result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || ''
      }
      if (task.status === 'failed') {
        console.warn(`[SampleGenerator] 任务失败(seed=${seed}):`, task.error)
        return ''
      }
    }

    return ''  // 超时
  } catch (err: any) {
    console.warn(`[SampleGenerator] 异常(seed=${seed}): ${err.message}`)
    return ''
  }
}
