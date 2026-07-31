/**
 * real-task-adapter.ts — Real Task RenderAdapter
 *
 * 将 LocalMockRenderer 替换为真正的 BullMQ 任务提交。
 * 每个 Blueprint 中的场景被拆分为独立的图片/视频 Task 入队。
 *
 * 这是 昆仑镜 → 火麒麟 的桥接层。
 * 不做完整同步，只保证输出经过真实执行链路。
 */

import { renderExecutor } from './render-executor.js'
import type { RenderInput, RenderResult } from './render-adapter.js'

export class RealTaskRenderer {
  name = 'real-task-renderer'

  /**
   * 将 frozen blueprint 拆解为真实 Task 并提交到 BullMQ
   */
  async render(input: RenderInput): Promise<RenderResult> {
    const { traceId, blueprint } = input
    const sceneData = blueprint.data?.sceneData || blueprint.data?.scenes || []
    const shotTexts = blueprint.data?.shotTexts || []
    const projectId = blueprint.data?.projectId || 'director-internal'

    const taskIds: string[] = []

    // 对每个场景/镜头创建真实任务
    for (const scene of sceneData) {
      try {
        const { enqueueTask } = await import('../queue/queue-manager.js')
        const taskId = await enqueueTask({
          taskType: 'image',
          projectId,
          userId: 'director-system',
          input: {
            prompt: scene.prompt || scene.description || '',
            source: 'director_workbench',
            traceId,
          },
        })
        taskIds.push(taskId)
      } catch (e: any) {
        console.warn(`[RealTaskRenderer] 入队失败 scene=${scene.name}: ${e.message}`)
      }
    }

    // 如果没有场景数据，退回到使用 renderExecutor 的 compilePrompts
    if (sceneData.length === 0 && shotTexts.length > 0) {
      try {
        const shots = shotTexts.map((t: string, i: number) => ({
          shotNumber: i + 1,
          description: t,
          action: t,
          dialogue: '',
          duration: 4,
        }))
        const job = await renderExecutor.compilePrompts(projectId, '', '', shots, {})
        if (job.results?.images) {
          for (const img of job.results.images) {
            if (img.url && !img.url.startsWith('mock')) {
              taskIds.push(`render-image-${img.shotIndex}`)
            }
          }
        }
      } catch (e: any) {
        console.warn(`[RealTaskRenderer] compilePrompts 失败: ${e.message}`)
      }
    }

    return {
      videoUrl: taskIds.length > 0
        ? `/api/stub/real-tasks?ids=${taskIds.join(',')}`
        : '',
      duration: sceneData.length > 0 ? sceneData.length * 4 : 30,
      meta: {
        mode: 'real',
        traceId,
        taskIds,
        taskCount: taskIds.length,
        blueprintId: blueprint.blueprintId,
      },
    }
  }
}
