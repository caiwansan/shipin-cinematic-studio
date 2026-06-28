// ============================================================
// Submit Stage — 提交图片生成任务
//
// Retry Scope: 是（D2）
// 职责：将 ImageTaskInput 提交到 ai-generate 任务队列
// ============================================================

import type { PipelineStage, ImageTaskInput, SubmitOutput, ExecutionContext } from '../types.js'

/**
 * 提交图片生成任务到 ai-generate
 * 从 execution-images.ts 的 submitImageTask 提取提交逻辑
 */
async function submitTask(
  input: ImageTaskInput,
  baseUrl: string,
  authHeader: string,
): Promise<SubmitOutput> {
  const taskInput: any = {
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    source: input.source,
    characterName: input.characterName,
    name: input.characterName,
  }
  if (input.seed !== undefined) taskInput.seed = input.seed
  if (input.referenceImage) {
    taskInput.referenceImage = input.referenceImage
    taskInput.referenceImages = input.referenceImages || [input.referenceImage]
  }

  const res = await fetch(`${baseUrl}/api/tasks/ai-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ projectId: input.projectId, taskType: 'image', input: taskInput }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`图片生成任务提交失败: ${res.status} ${errText}`)
  }

  const data = await res.json()
  const taskId = data?.task?.id
  if (!taskId) throw new Error('未获取到任务 ID')

  return { taskId }
}

export function createSubmitStage(baseUrl: string, authHeader: string): PipelineStage<ImageTaskInput, SubmitOutput> {
  return {
    name: 'submit',
    async execute(input: ImageTaskInput, ctx: ExecutionContext): Promise<SubmitOutput> {
      // Phase 4.1: 记录 final prompt 供 AnchorSync drift proxy 使用
      ctx.finalPrompt = input.prompt
      return await submitTask(input, baseUrl, authHeader)
    },
  }
}
