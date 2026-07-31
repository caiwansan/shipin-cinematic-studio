/**
 * director-execution-adapter.ts
 *
 * 昆仑镜 → 火麒麟 单向执行适配器。
 *
 * 职责：
 *   输入：DirectorExecutionPlan
 *   输出：逐个调用 /api/tasks/ai-generate → BullMQ
 *
 * 禁止：
 *   ❌ 不调 AI Provider
 *   ❌ 不创建新队列
 *   ❌ 不绕过 Task Runtime
 *   ❌ 不创建新 Asset 系统
 *
 * 正确：
 *   DirectorExecutionPlan
 *     ↓
 *   Adapter
 *     ↓
 *   /api/tasks/ai-generate
 *     ↓
 *   BullMQ ai-runtime
 *     ↓
 *   Worker → Provider → Asset
 */

import type { DirectorExecutionPlan, ExecutionScene } from '../types/director-execution-plan.js'

// ── 执行结果 ──

export interface AdapterExecutionResult {
  success: boolean
  projectId: string
  source: string
  tasks: Array<{
    sceneId: string
    taskType: 'image' | 'video' | 'tts'
    taskId: string
    status: 'queued' | 'failed'
    error?: string
  }>
  summary: {
    totalTasks: number
    queued: number
    failed: number
  }
}

// ── 任务提交接口 ──

/**
 * TaskSubmitter — 可替换的任务提交实现。
 * 生产环境使用 HTTP 调用 /api/tasks/ai-generate，测试时可 mock。
 */
export interface TaskSubmitter {
  submitImage(params: {
    projectId: string
    userId: string
    prompt: string
    characterRefs?: string[]
    style?: string
    aspectRatio?: string
  }): Promise<{ taskId: string; error?: string }>

  submitVideo(params: {
    projectId: string
    userId: string
    prompt: string
    duration: number
    motion: string
    imageAssetId?: string
  }): Promise<{ taskId: string; error?: string }>

  submitTTS(params: {
    projectId: string
    userId: string
    text: string
    voice: string
    emotion?: string
  }): Promise<{ taskId: string; error?: string }>
}

// ── 默认 HTTP 提交器 ──

/**
 * createHttpSubmitter — 通过 HTTP 调用 /api/tasks/ai-generate
 *
 * 这是生产使用的提交器。
 * 使用 Fastify 的 inject 或 fetch，取决于上下文。
 *
 * @param apiBase API 基础 URL（生产留空，使用 server.inject）
 * @param token 认证 token（传空则使用 cookie/session）
 */
export function createHttpSubmitter(
  apiBase?: string,
  token?: string,
): TaskSubmitter {
  const base = apiBase || ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  async function submit(taskType: string, input: Record<string, unknown>): Promise<{ taskId: string; error?: string }> {
    try {
      const res = await fetch(`${base}/api/tasks/ai-generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskType,
          projectId: input.projectId,
          input: {
            prompt: input.prompt,
            promptSource: 'storyboard',
            ...input,
          },
          priority: 1,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        return { taskId: '', error: json.error || 'task submission failed' }
      }
      return { taskId: json.task?.id || '' }
    } catch (e: any) {
      return { taskId: '', error: e.message }
    }
  }

  return {
    async submitImage(params) {
      return submit('image', params as any)
    },
    async submitVideo(params) {
      return submit('video', params as any)
    },
    async submitTTS(params) {
      return submit('tts', params as any)
    },
  }
}

// ── 核心适配器 ──

/**
 * executePlan — 执行 DirectorExecutionPlan
 *
 * 遍历所有场景，为每个 scene 提交 image/video/audio 任务。
 * 所有任务通过 TaskSubmitter 提交到 /api/tasks/ai-generate。
 */
export async function executePlan(
  plan: DirectorExecutionPlan,
  submitter: TaskSubmitter,
  userId: string,
): Promise<AdapterExecutionResult> {
  const tasks: AdapterExecutionResult['tasks'] = []
  let queued = 0
  let failed = 0

  for (const scene of plan.scenes) {
    // 1. Image tasks
    for (const imgTask of scene.tasks.imageTasks) {
      const result = await submitter.submitImage({
        projectId: plan.projectId,
        userId,
        prompt: imgTask.prompt,
        characterRefs: imgTask.characterRefs,
        style: imgTask.style,
        aspectRatio: imgTask.aspectRatio,
      })

      tasks.push({
        sceneId: scene.sceneId,
        taskType: 'image',
        taskId: result.taskId,
        status: result.error ? 'failed' : 'queued',
        error: result.error,
      })

      if (result.error) failed++
      else queued++
    }

    // 2. Video tasks
    for (const vidTask of scene.tasks.videoTasks) {
      const result = await submitter.submitVideo({
        projectId: plan.projectId,
        userId,
        prompt: vidTask.prompt || '',
        duration: vidTask.duration,
        motion: vidTask.motion,
        imageAssetId: vidTask.imageAssetId,
      })

      tasks.push({
        sceneId: scene.sceneId,
        taskType: 'video',
        taskId: result.taskId,
        status: result.error ? 'failed' : 'queued',
        error: result.error,
      })

      if (result.error) failed++
      else queued++
    }

    // 3. TTS tasks
    for (const audioTask of scene.tasks.audioTasks) {
      const result = await submitter.submitTTS({
        projectId: plan.projectId,
        userId,
        text: audioTask.text,
        voice: audioTask.voice,
        emotion: audioTask.emotion,
      })

      tasks.push({
        sceneId: scene.sceneId,
        taskType: 'tts',
        taskId: result.taskId,
        status: result.error ? 'failed' : 'queued',
        error: result.error,
      })

      if (result.error) failed++
      else queued++
    }
  }

  return {
    success: failed === 0,
    projectId: plan.projectId,
    source: plan.source,
    tasks,
    summary: {
      totalTasks: tasks.length,
      queued,
      failed,
    },
  }
}

// ── 场景级执行（用于单场景调试） ──

/**
 * executeScene — 仅执行一个场景
 *
 * 用于 Task 01.4 的单场景验证。
 * 不依赖完整 plan，只提交指定 scene 的任务。
 */
export async function executeScene(
  scene: ExecutionScene,
  projectId: string,
  submitter: TaskSubmitter,
  userId: string,
): Promise<AdapterExecutionResult> {
  const plan: DirectorExecutionPlan = {
    projectId,
    source: 'kunlun-director',
    scenes: [scene],
    metadata: {
      createdBy: 'single-scene-run',
      version: '1.0.0',
      createdAt: Date.now(),
    },
  }

  return executePlan(plan, submitter, userId)
}
