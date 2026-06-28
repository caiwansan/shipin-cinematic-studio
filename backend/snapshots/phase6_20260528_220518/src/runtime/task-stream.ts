/**
 * runtime/task-stream.ts — SSE 实时任务流
 *
 * 替代前端轮询，通过 EventSource 推送任务状态更新
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { taskEventEmitter } from '../utils/index.js'

interface SSEClient {
  id: string
  userId: string
  reply: FastifyReply
  filters?: {
    taskId?: string
    projectId?: string
    taskTypes?: string[]
  }
}

const clients = new Map<string, SSEClient>()

export function registerSSEStream(fastify: FastifyInstance): void {
  fastify.get('/api/runtime/task-stream', async (request, reply) => {
    const query = request.query as any
    const taskId = query?.taskId || null
    const projectId = query?.projectId || null
    // 从 query 参数获取 userId（EventSource 无法自定义 header，故不强制认证）
    const userId = request.userId || query?.userId || (request as any)?.user?.id || 'anonymous'
    const user = { id: userId }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const clientId = `sse-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const client: SSEClient = {
      id: clientId,
      userId: user.id,
      reply,
      filters: { taskId: taskId || undefined, projectId: projectId || undefined },
    }
    clients.set(clientId, client)

    // 发送初始连接确认
    reply.raw.write(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`)

    // 心跳保持连接
    const heartbeat = setInterval(() => {
      try { reply.raw.write(`:heartbeat ${Date.now()}\n\n`) } catch { cleanup() }
    }, 30000)

    const onProgress = (data: any) => {
      // 如果客户端设置了 taskId 过滤，只推送相关事件
      if (client.filters?.taskId && client.filters.taskId !== data.taskId) return
      if (client.filters?.projectId && client.filters.projectId !== data.projectId) return
      try {
        reply.raw.write(`event: ${data.status || 'progress'}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch { cleanup() }
    }

    taskEventEmitter.on('task:progress', onProgress)

    const cleanup = () => {
      clearInterval(heartbeat)
      taskEventEmitter.off('task:progress', onProgress)
      clients.delete(clientId)
    }

    request.raw.on('close', cleanup)
    request.raw.on('error', cleanup)
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

