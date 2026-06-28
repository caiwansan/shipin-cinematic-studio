import type { ApiResponse } from '../contracts/api/base.js';
import crypto from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { prisma, taskEventEmitter } from '../utils/index.js'
import { env } from '../config/env.js'
import { enqueueTask } from '../queue/queue-manager.js'
import type { RuntimePayload } from '../runtime/runtime-payload.js'
import { scheduler } from '../services/scheduler.service.js'
import { rfvl, generateTraceId } from '../runtime/rfvl-injector.js'
import { resolveProviderFromUserConfig, taskTypeToCapability } from '../runtime-provider-resolver.js'
import { checkDailyQuota, incrementDailyUsage } from '../services/usage-quota.service.js'

/**
 * AI 任务 API — 将 AI 生成请求统一化为任务队列
 * 
 * 支持任务类型:
 * - image: 图片生成（角色/场景/分镜/帧图）
 * - tts: 语音生成
 * - video: 视频合成
 * 
 * 所有任务通过 scheduler.submit() 入队，异步执行
 */

export default async function aiTaskRoutes(fastify: FastifyInstance) {
  
  // POST /api/tasks/ai-generate — 创建 AI 生成任务
  fastify.post('/api/tasks/ai-generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId, taskType, input, priority = 1 } = request.body as any

    // ⭐ 配额检查：所有 AI 任务必须先通过每日限额
    const quota = await checkDailyQuota(user.id)
    if (!quota.canProceed) {
      return reply.status(403).send({
        success: false,
        error: `今日 AI 调用次数已达上限（${quota.limit} 次）`,
        quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining },
      })
    }

    // RFVL: 启动执行证明 trace
    const traceId = generateTraceId()
    const proof = rfvl.startTrace(traceId)
    proof.sealGate({
      entry: '/api/tasks/ai-generate',
      route: '/api/tasks/ai-generate',
      method: 'POST',
      userId: user?.id?.substring(0, 8),
    })

    if (!projectId || !taskType) {
      return reply.status(400).send({ success: false, error: '缺少 projectId 或 taskType' })
    }

    const validTypes = ['image', 'tts', 'video', 'frame']
    if (!validTypes.includes(taskType)) {
      return reply.status(400).send({ success: false, error: `不支持的 taskType: ${taskType}，支持: ${validTypes.join(', ')}` })
    }

    // 清除旧的 volcengine provider_state（安全护栏缓存），防止遗留的 invalid_key 阻断
    taskCleanupProviderState(user?.id)
    let project: any
    try {
      project = await prisma.project.findUnique({ where: { id: projectId } })
    } catch (_e) {
      // projectId 不是有效 UUID 格式（如 'draft'），当作不存在处理
    }
    if (!project) {
      // 用于创建临时项目/草稿项目的实际 ID
      const actualId = projectId.startsWith('00000000-') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
        ? projectId
        : crypto.randomUUID()

      project = await prisma.project.create({
        data: {
          id: actualId,
          userId: user.id,
          name: '临时项目',
        },
      })
    }

    // 创建任务记录
    const task = await prisma.videoTask.create({
      data: {
        projectId,
        taskType,
        priority,
        status: 'queued',
        // 将输入参数序列化存储到 error 字段暂存（未来可加专用字段）
        error: JSON.stringify({
          userId: user.id,
          input,
          createdAt: new Date().toISOString(),
        }),
      },
    })

    // === Capability Routing（Router 只做这件事） ===
    // taskType → capability 分类
    // model + user config → runtime provider binding（由 runtime-provider-resolver 完成）
    // Router 不决定 provider/Key/endpoint
    let runtime: RuntimePayload | undefined

    const preferModel = input?.model || ''

    // 唯一入口：Router → (model, taskType) → resolveProvider → (provider, apiKey, model)
    // 零 fallback 零兜底
    try {
      const resolved = await resolveProviderFromUserConfig(user.id, preferModel, taskType)
      runtime = {
        provider: resolved.provider,
        apiKey: resolved.apiKey,
        model: resolved.model,
        baseURL: resolved.baseURL,
        userId: user.id,
        taskType: resolved.taskType,
      }
      console.log(`[ai-tasks] 🎯 能力路由: 用户 ${user.id.substring(0,8)} capability=${taskTypeToCapability(taskType)} provider=${resolved.provider} model=${resolved.model} apiKeyPrefix=${(resolved.apiKey || '').substring(0,15)}`)
    } catch (err: any) {
      console.warn(`[ai-tasks] ⚠️ 用户 ${user.id.substring(0,8)} 没有配置 ${taskType} 的 API Key: ${err.message}`)
      return reply.status(400).send({
        success: false,
        error: err.message,
      })
    }

    // RFVL: 队列步骤
    proof.sealQueue({
      taskId: task.id,
      queueName: 'ai-runtime',
      timestamp: Date.now(),
    })

    // 提交到统一队列（带上 runtime 使 Worker 直接调用真实 Provider）
    await enqueueTask({
      taskType,
      projectId,
      userId: user.id,
      input,
      priority,
      taskId: task.id,
      runtime,
    })

    // RFVL: 完成 trace（后续步骤由 Worker 完成）
    rfvl.completeTrace(traceId)

    // ⭐ 更新配额用量
    incrementDailyUsage(user.id, 'llm').catch(() => {})

    return {
      success: true,
      task: {
        id: task.id,
        projectId,
        taskType,
        status: 'queued',
        priority,
      },
    }
  })

  // GET /api/tasks/:id/status — 查询任务状态
  fastify.get('/api/tasks/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const task = await prisma.videoTask.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        taskType: true,
        status: true,
        progress: true,
        error: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    })

    if (!task) {
      return reply.status(404).send({ success: false, error: '任务不存在' })
    }

    // 如果是完成状态，尝试获取结果
    let result = null
    if (task.status === 'completed' || task.status === 'failed') {
      try {
        const errorData = JSON.parse(task.error || '{}')
        if (errorData.output) {
          result = errorData.output
        }
      } catch {}
    }

    return { success: true, task: { ...task, result } } satisfies ApiResponse<unknown>;

  })

  // GET /api/tasks/:id/result — 获取任务结果（图片/音频 URL）
  fastify.get('/api/tasks/:id/result', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    // 先查 videoTask（图片/视频等任务）
    const task = await prisma.videoTask.findUnique({ where: { id } })
    if (task && task.status === 'completed') {
      // 从 error 字段提取 output（Worker 写入）
      try {
        const errorData = JSON.parse(task.error || '{}')
        const url = errorData.output?.url || errorData.url || errorData.image_urls?.[0]
        if (url) {
          return { success: true, data: { url } } satisfies ApiResponse<unknown>;

        }
      } catch {}
      return { success: true, data: { status: 'completed', url: null } } satisfies ApiResponse<unknown>;

    }

    // 再查 taskQueue（统一队列）
    const queueTask = await prisma.taskQueue.findUnique({ where: { id } })
    if (queueTask) {
      if (queueTask.status === 'completed') {
        let url = null
        try {
          const payload = JSON.parse(typeof queueTask.payload === 'string' ? queueTask.payload : '{}')
          url = payload.url || payload.image_url || payload.image_urls?.[0] || payload.output?.url
        } catch {}
        return { success: true, data: { url, status: 'completed' } } satisfies ApiResponse<unknown>;

      }
      return { success: true, data: { status: queueTask.status || 'processing' } } satisfies ApiResponse<unknown>;

    }

    return { success: true, data: { status: 'processing' } } satisfies ApiResponse<unknown>;

  })

  fastify.post('/api/tasks/batch-create', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId, tasks } = request.body as any

    if (!projectId || !Array.isArray(tasks) || tasks.length === 0) {
      return reply.status(400).send({ success: false, error: '缺少 projectId 或 tasks 为空' })
    }

    const created: any[] = []
    for (const t of tasks) {
      const task = await prisma.videoTask.create({
        data: {
          projectId,
          taskType: t.taskType || 'image',
          priority: t.priority || 1,
          status: 'queued',
          error: JSON.stringify({
            userId: user.id,
            input: t.input,
            createdAt: new Date().toISOString(),
          }),
        },
      })

      await scheduler.submit({
        projectId,
        priority: t.priority || 1,
        taskType: t.taskType || 'image',
        idempotencyKey: task.id,
      })

      created.push({ id: task.id, taskType: task.taskType })
    }

    return { success: true, tasks: created } satisfies ApiResponse<unknown>;

  })

  // POST /api/provider-cache/cleanup — 清理 provider 缓存（供前端生成按钮调用）
  fastify.post('/api/provider-cache/cleanup', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user || null
    const userId = user?.id || ''
    const body = request.body as any || {}
    const type = (body?.type as string) || ''

    console.log(`[provider-cache] 🧹 清理缓存: userId=${userId?.substring(0,8) || 'anonymous'}, type=${type}`)

    await taskCleanupProviderState(userId)

    return { success: true }
  })
}

async function taskCleanupProviderState(userId?: string) {
  if (!userId) return
  if (typeof prisma?.providerState?.deleteMany === 'function') {
    try {
      await (prisma as any).providerState.deleteMany({
        where: { userId, provider: 'volcengine' },
      })
    } catch (_) {}
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};
