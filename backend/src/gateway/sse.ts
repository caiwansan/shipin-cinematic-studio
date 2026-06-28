// ============================================================================
// 盘古斧 AI OS — Phase 7A-STABILIZE SSE Event Stream (背压集成版)
// 使用 BackpressureController 控制 SSE 发射频率
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { runtimeEventBus, type AnchoredEvent } from '../events/stabilized-event-bus.js'
import { backpressureController } from '../events/backpressure-controller.js'

interface SSEClient {
  id: string
  reply: FastifyReply
  filters?: string[]
}

let clientIdCounter = 0
const clients = new Map<string, SSEClient>()

export async function registerSSEEndpoint(app: FastifyInstance) {
  // ── SSE 订阅端点 ────────────────────────────────────────────────────

  app.get('/api/events', async (req: FastifyRequest, reply: FastifyReply) => {
    const clientId = `sse_${++clientIdCounter}`
    const query = req.query as { filter?: string }
    const filters = query.filter ? query.filter.split(',') : undefined

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    })

    const client: SSEClient = { id: clientId, reply, filters }
    clients.set(clientId, client)

    // 发送初始连接事件
    reply.raw.write(`data: ${JSON.stringify({
      type: 'connection.established',
      clientId,
      tick: runtimeEventBus.totalTicks,
      timestamp: new Date().toISOString()
    })}\n\n`)

    // 订阅事件总线
    const unsubscribe = runtimeEventBus.on('*', (event: AnchoredEvent) => {
      if (client.filters && !client.filters.includes(event.type)) return

      // 通过背压控制器
      const bpResult = backpressureController.push(event)
      if (bpResult.accepted) {
        try {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
        } catch {
          unsubscribe()
          clients.delete(clientId)
        }
      }
    })

    // 背压批处理回调（MODERATE 模式定时刷新）
    backpressureController.onBatch((batch) => {
      if (batch.length === 0) return
      try {
        reply.raw.write(`data: ${JSON.stringify({
          type: 'sse.batch',
          count: batch.length,
          events: batch,
          timestamp: new Date().toISOString()
        })}\n\n`)
      } catch {
        clients.delete(clientId)
      }
    })

    // 心跳保活（每 10s）
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(':heartbeat\n\n')
      } catch {
        clearInterval(heartbeat)
        clients.delete(clientId)
      }
    }, 10000)

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      clients.delete(clientId)
    })

    console.log(`[SSE] Client ${clientId} connected (${clients.size} total)`)
  })

  // ── 连接状态 ────────────────────────────────────────────────────────

  app.get('/api/events/clients', async (_req: FastifyRequest, reply: FastifyReply) => {
    return {
      total: clients.size,
      clients: Array.from(clients.keys())
    }
  })

  // ── 事件发布（经过 StabilizedEventBus 三层检查） ───────────────────

  app.post('/api/events/emit', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    if (!body || !body.type) {
      return reply.status(400).send({ error: 'Missing event type' })
    }
    const event = runtimeEventBus.emit(body.type, body.data || {}, body.traceId)
    if (!event) {
      return reply.status(425).send({
        emitted: false,
        error: 'INTEGRITY_GATE_REJECTED',
        status: runtimeEventBus.getStatusSnapshot()
      })
    }
    return {
      emitted: true,
      event: { tick: event.tick, type: event.type },
      connectedClients: clients.size,
      status: runtimeEventBus.getStatusSnapshot()
    }
  })

  // ── 事件历史 ────────────────────────────────────────────────────────

  app.get('/api/events/history', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { types?: string; limit?: string }
    const types = query.types ? (query.types.split(',') as any[]) : undefined
    const limit = parseInt(query.limit || '50')
    return {
      totalTicks: runtimeEventBus.totalTicks,
      totalEvents: runtimeEventBus.totalEvents,
      backpressure: backpressureController.getStatus(),
      events: runtimeEventBus.getHistory(types, limit)
    }
  })
}
