// ============================================================
// Poll Stage — 轮询等待图片生成结果
//
// Retry Scope: 是（D2）
// 职责：轮询 task status 直到 completed / failed / 超时
// ============================================================

import type { PipelineStage, SubmitOutput, PollOutput, ExecutionContext } from '../types.js'

const POLL_MAX_ATTEMPTS = 30
const POLL_INTERVAL_MS = 2000

async function pollTask(
  taskId: string,
  baseUrl: string,
  authHeader: string,
): Promise<string> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const res = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
      headers: { authorization: authHeader },
    })
    if (!res.ok) continue

    const data = await res.json()
    const task = data?.task
    if (!task) continue

    if (task.status === 'completed') {
      const result = task.result || {}
      let url = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || ''

      // 兜底：尝试从 error 字段提取
      if (!url && task.error) {
        try {
          const err = JSON.parse(task.error)
          url = err?.output?.imageUrl || err?.output?.url || ''
        } catch {
          // 非关键路径
        }
      }

      return url
    }

    if (task.status === 'failed') {
      throw new Error(`图片生成任务失败: ${task.error || 'unknown'}`)
    }
  }

  throw new Error(`图片生成轮询超时 (${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS}ms)`)
}

export function createPollStage(baseUrl: string, authHeader: string): PipelineStage<SubmitOutput, PollOutput> {
  return {
    name: 'poll',
    async execute(input: SubmitOutput, ctx: ExecutionContext): Promise<PollOutput> {
      const startTime = Date.now()
      const imageUrl = await pollTask(input.taskId, baseUrl, authHeader)
      return {
        taskId: input.taskId,
        imageUrl,
        duration: Date.now() - startTime,
      }
    },
  }
}
