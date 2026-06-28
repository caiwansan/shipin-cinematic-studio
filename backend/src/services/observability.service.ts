/**
 * Observability Event Bus v1 — SSE 实时事件总线
 * 
 * 发射系统所有运行时事件，供 Dashboard 消费。
 * 事件类型：
 *   task.updated       — 任务状态变更
 *   worker.status      — Worker 健康变化
 *   model.metric       — 模型指标更新
 *   cost.update        — 成本波动
 *   shadow.diff        — Shadow Diff 完成
 *   drift.alert        — 漂移超限警告
 *   circuit.breaker    — 熔断器状态变更
 *   budget.alert       — 预算预警
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// SSE 客户端管理
interface SSEClient {
  id: string
  res: FastifyReply
  filters?: string[]  // 事件类型过滤，空=全部
  createdAt: number
}

const clients = new Map<string, SSEClient>()
let clientCounter = 0

// ============================================================
// SSE 端点注册
// ============================================================

export function registerObservabilitySSE(fastify: FastifyInstance) {
  // SSE 连接端点（无需认证 — 只读展示）
  fastify.get('/api/events/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any

    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    })

    const clientId = `client-${++clientCounter}-${Date.now()}`
    const filters = query.filters ? (query.filters as string).split(',') : undefined

    const client: SSEClient = {
      id: clientId,
      res: reply,
      filters,
      createdAt: Date.now(),
    }

    clients.set(clientId, client)

    // 发送初始连接确认
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ clientId, serverTime: new Date().toISOString() })}\n\n`)

    // 心跳保活（每 15s）
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`:heartbeat\n\n`)
      } catch {
        clearInterval(heartbeat)
        clients.delete(clientId)
      }
    }, 15000)

    // 客户端断开时清理
    request.raw.on('close', () => {
      clearInterval(heartbeat)
      clients.delete(clientId)
    })
  })
}

// ============================================================
// 事件发射
// ============================================================

interface ObservabilityEvent {
  type: string
  data: any
  timestamp?: string
}

export function emitEvent(type: string, data: any) {
  const event: ObservabilityEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
  }

  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`

  for (const [id, client] of clients) {
    if (client.filters && !client.filters.includes(type)) continue
    try {
      client.res.raw.write(payload)
    } catch {
      clients.delete(id)
    }
  }
}

// ============================================================
// 客户端统计
// ============================================================

export function getSSEClientCount(): number {
  return clients.size
}

// ============================================================
// 上下文聚合端点：全量快照（非 SSE，REST 轮询用）
// ============================================================

export async function registerObservabilityREST(fastify: FastifyInstance) {
  // 全量态势快照（无需认证 — 只读展示）
  fastify.get('/api/observability/snapshot', async (_request, reply) => {
    const { prisma } = await import('../utils/index.js')

    try {
      // 任务统计
      const taskCounts = await prisma.$queryRawUnsafe<Array<{ status: string; count: bigint }>>(
        `SELECT status, COUNT(*)::int as count FROM "VideoTask" GROUP BY status`
      )
      const totalTasks = taskCounts.reduce((sum, r) => sum + Number(r.count), 0)
      const successTasks = taskCounts.find((r: any) => r.status === 'completed')?.count ?? 0
      const failedTasks = taskCounts.filter((r: any) => ['failed'].includes(r.status)).reduce((sum, r) => sum + Number(r.count), 0)

      // Worker 统计（如果表存在）
      let workers: any[] = []
      try {
        workers = await prisma.$queryRawUnsafe<Array<any>>(
          `SELECT * FROM "WorkerRegistration" ORDER BY "lastHeartbeat" DESC`
        )
      } catch {
        workers = []
      }

      // 模型统计
      const modelsRaw = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT m.*, cb.state as breaker_state FROM "AiModel" m LEFT JOIN "AiCircuitBreaker" cb ON cb."modelId" = m.name`
      )
      const models = modelsRaw.map((m: any) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        taskType: m.taskType,
        costPerRequest: Number(m.costPerRequest ?? 0).toFixed(6),
        circuitBreaker: m.breaker_state ?? 'closed',
      }))

      // 成本统计
      const budgets = await prisma.costBudget.findMany({ where: { enabled: true } })
      const globalBudget = budgets.find(b => b.scope === 'global')
      const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spentAmount), 0)
      const totalBudget = budgets.reduce((sum, b) => sum + Number(b.budgetAmount), 0)

      // Shadow 统计
      const shadowExecutions = await prisma.shadowExecutionLog.count()
      const shadowSuccess = await prisma.shadowExecutionLog.count({ where: { status: 'success' } })
      const shadowFail = await prisma.shadowExecutionLog.count({ where: { status: { in: ['failed', 'timeout', 'shadow_failed'] } } })

      // 熔断器统计
      const openBreakers = await prisma.aiCircuitBreaker.findMany({ where: { state: 'open' } })

      // 队列深度
      const dlqCount = await prisma.deadLetterTask?.count() ?? 0

      return reply.send({
        health: calculateHealthScore({
          successRate: totalTasks > 0 ? Number(successTasks) / totalTasks : 1,
          workerCount: workers.length,
          openBreakers: openBreakers.length,
          shadowHealth: shadowExecutions > 0 ? shadowSuccess / shadowExecutions : 1,
          budgetHealth: globalBudget && Number(globalBudget.budgetAmount) > 0
            ? 1 - Number(globalBudget.spentAmount) / Number(globalBudget.budgetAmount)
            : 1,
        }),
        tasks: {
          total: totalTasks,
          completed: Number(successTasks),
          failed: Number(failedTasks),
          byStatus: taskCounts,
        },
        workers: workers.map((w: any) => ({
          id: w.id,
          name: w.name,
          status: w.status,
          healthScore: w.healthScore ? Number(w.healthScore).toFixed(2) : 'N/A',
          currentLoad: w.currentLoad,
          capacity: w.capacity,
          lastHeartbeat: w.lastHeartbeat,
        })),
        models: models.map((m: any) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          taskType: m.taskType,
          costPerRequest: Number(m.costPerRequest).toFixed(6),
          circuitBreaker: m.circuitBreaker?.state ?? 'closed',
        })),
        costs: {
          totalSpent: Number(totalSpent.toFixed(4)),
          totalBudget: Number(totalBudget.toFixed(4)),
          globalUsage: globalBudget && Number(globalBudget.budgetAmount) > 0
            ? ((Number(globalBudget.spentAmount) / Number(globalBudget.budgetAmount)) * 100).toFixed(1)
            : '0',
          byScope: budgets.map(b => ({
            scope: b.scope,
            scopeId: b.scopeId,
            budget: Number(b.budgetAmount),
            spent: Number(b.spentAmount),
            usage: Number(b.budgetAmount) > 0 ? ((Number(b.spentAmount) / Number(b.budgetAmount)) * 100).toFixed(1) : '0',
          })),
        },
        shadow: {
          total: shadowExecutions,
          success: shadowSuccess,
          failed: shadowFail,
          successRate: shadowExecutions > 0 ? ((shadowSuccess / shadowExecutions) * 100).toFixed(1) + '%' : '0%',
        },
        risks: {
          openBreakers: openBreakers.length,
          workerCrashRate: workers.length > 0
            ? (workers.filter((w: any) => w.status === 'unhealthy').length / workers.length * 100).toFixed(1) + '%'
            : '0%',
          dlqCount: Number(dlqCount),
        },
        sseClients: getSSEClientCount(),
      })
    } finally {
      await prisma.$disconnect()
    }
  })
}

// ============================================================
// 健康度计算
// ============================================================

function calculateHealthScore(metrics: {
  successRate: number
  workerCount: number
  openBreakers: number
  shadowHealth: number
  budgetHealth: number
}): number {
  const score =
    metrics.successRate * 0.35 +
    (metrics.workerCount > 0 ? 0.2 : 0) * 0.15 +
    (metrics.openBreakers === 0 ? 0.2 : 0) +
    metrics.shadowHealth * 0.15 +
    metrics.budgetHealth * 0.15

  return Math.round(score * 100)
}

// 在 index.ts 中注册时需要调用这两个函数
