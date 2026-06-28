import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { videoService } from '../services/video.service.js'
import { taskEventEmitter, prisma } from '../utils/index.js'
import { scheduler } from '../services/scheduler.service.js'
import { workerPool } from '../services/worker-pool.service.js'

export default async function taskRoutes(fastify: FastifyInstance) {
  // GET /api/projects/:projectId/tasks
  fastify.get('/api/projects/:projectId/tasks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    return await videoService.findByProject(projectId)
  })

  // GET /api/tasks/:id
  fastify.get('/api/tasks/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await videoService.findById(id)
  })

  // POST /api/projects/:projectId/tasks
  fastify.post('/api/projects/:projectId/tasks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    const data = request.body as any
    return await videoService.create(projectId, data)
  })

  // POST /api/tasks/:id/cancel
  fastify.post('/api/tasks/:id/cancel', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await videoService.cancel(id)
  })

  // GET /api/tasks/:id/segments
  fastify.get('/api/tasks/:id/segments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await videoService.getSegments(id)
  })

  // SSE: GET /api/tasks/stream - 实时推送 + 事件回放
  fastify.get('/api/tasks/stream', async (request, reply) => {
    const lastEventId = (request.headers['last-event-id'] as string) || null
    const taskIdFilter = (request.query as any)?.taskId || null

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    // === 事件回放：如果带了 last-event-id，补发遗漏事件 ===
    if (lastEventId) {
      try {
        const missedLogs = await prisma.taskLog.findMany({
          where: {
            eventId: { not: null, gt: lastEventId },
            ...(taskIdFilter ? { taskId: taskIdFilter } : {}),
          },
          orderBy: { createdAt: 'asc' },
          take: 100,
        })
        for (const log of missedLogs) {
          reply.raw.write(`id: ${log.eventId}\ndata: ${JSON.stringify({
            type: 'replay',
            taskId: log.taskId,
            status: extractStatusFromMessage(log.message),
            progress: 0,
            message: log.message,
            eventId: log.eventId,
            timestamp: log.createdAt.toISOString(),
          })}\n\n`)
        }
        if (missedLogs.length > 0) {
          console.log(`🔁 Replayed ${missedLogs.length} events for last-event-id: ${lastEventId}`)
        }
      } catch (err) {
        console.error('SSE replay error:', err)
      }
    }

    // === 心跳 ===
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n')
    }, 15000)

    const onProgress = (data: any) => {
      // 如果要过滤特定 taskId
      if (taskIdFilter && data.taskId !== taskIdFilter) return
      const idField = data.eventId || `${data.taskId}:${data.status}:${Date.now()}`
      reply.raw.write(`id: ${idField}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    taskEventEmitter.on('task:progress', onProgress)

    request.raw.on('close', () => {
      clearInterval(heartbeat)
      taskEventEmitter.off('task:progress', onProgress)
    })
  })

  // GET /api/scheduler/status — 调度器状态监控
  fastify.get('/api/scheduler/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return await scheduler.getStatus()
  })

  // GET /api/scheduler/workers — Worker Pool 状态
  fastify.get('/api/scheduler/workers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return await workerPool.getStatus()
  })

  // POST /api/scheduler/workers/:id/recover — 恢复 Worker
  fastify.post('/api/scheduler/workers/:id/recover', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await workerPool.recoverWorker(id)
  })

  // PUT /api/scheduler/workers/:id/weight — 更新 Worker 权重
  fastify.put('/api/scheduler/workers/:id/weight', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { weight } = request.body as any
    return await workerPool.updateWeight(id, weight)
  })

  // GET /api/tasks/:id/failures — P1-3: 查询 task failure events
  fastify.get('/api/tasks/:id/failures', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { getFailureEvents } = await import('../services/failure-event.service.js')
    const events = await getFailureEvents(id)
    return { success: true, data: events } satisfies ApiResponse<unknown>;

  })
}

function extractStatusFromMessage(msg: string): string {
  if (msg.includes('优化')) return 'optimizing'
  if (msg.includes('分镜')) return 'storyboarding'
  if (msg.includes('生成') || msg.includes('进度')) return 'generating'
  if (msg.includes('拼接')) return 'stitching'
  if (msg.includes('完成')) return 'completed'
  return 'processing'
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

