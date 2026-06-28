import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function stabilityRoutes(fastify: FastifyInstance) {
  const prismaClient = prisma

  // ============================================
  // Task Queue
  // ============================================

  // 提交任务到队列（削峰入口）
  fastify.post('/api/stability/task/enqueue', async (request, reply) => {
    const { userId, type, priority, payload } = request.body as any
    if (!userId || !type) return reply.status(400).send({ error: 'userId/type 必填' })

    // 1. 检查限流
    const limits = await prismaClient.rateLimit.findFirst({ where: { userId, apiType: type } })
    if (limits && limits.currentUsage >= limits.limitPerMin) {
      return { throttled: true, message: '请求频率超限，请稍后再试', retryAfterMs: 30000 }
    }

    // 2. 检查熔断器
    const breaker = await prismaClient.circuitBreaker.findUnique({ where: { service: type } })
    if (breaker?.status === 'open') {
      return { blocked: true, message: `服务[${type}]熔断中，请稍后` }
    }

    // 3. 入队
    const task = await prismaClient.taskQueue.create({
      data: { userId, type, priority: priority || 50, payload: payload ? JSON.stringify(payload) : null },
    })

    // 4. 更新限流计数
    if (limits) {
      await prismaClient.rateLimit.update({
        where: { id: limits.id },
        data: { currentUsage: { increment: 1 } },
      })
    } else {
      await prismaClient.rateLimit.create({
        data: { userId, apiType: type, currentUsage: 1 },
      })
    }

    return { taskId: task.id, status: 'queued', position: 0 }
  })

  // 获取任务状态
  fastify.get('/api/stability/task/:id', async (request, reply) => {
    const { id } = request.params as any
    const task = await prismaClient.taskQueue.findUnique({ where: { id } })
    if (!task) return reply.status(404).send({ error: '任务不存在' })
    return { id: task.id, status: task.status, type: task.type, retryCount: task.retryCount, error: task.error }
  })

  // 获取队列统计
  fastify.get('/api/stability/queue/stats', async (_request, reply) => {
    const [pending, running, failed, total] = await Promise.all([
      prismaClient.taskQueue.count({ where: { status: 'pending' } }),
      prismaClient.taskQueue.count({ where: { status: 'running' } }),
      prismaClient.taskQueue.count({ where: { status: 'failed' } }),
      prismaClient.taskQueue.count(),
    ])
    return { pending, running, failed, total }
  })

  // ============================================
  // Circuit Breaker
  // ============================================

  // 获取熔断器状态
  fastify.get('/api/stability/breakers', async (_request, reply) => {
    const breakers = await prismaClient.circuitBreaker.findMany()
    return breakers.map(b => ({
      service: b.service, status: b.status,
      failureCount: b.failureCount, threshold: b.threshold,
      lastFailureTime: b.lastFailureTime,
      cooldownTime: b.cooldownTime,
    }))
  })

  // 记录失败（触发熔断计数）
  fastify.post('/api/stability/breaker/fail', async (request, reply) => {
    const { service } = request.body as any
    if (!service) return reply.status(400).send({ error: 'service 必填' })

    let breaker = await prismaClient.circuitBreaker.findUnique({ where: { service } })
    if (!breaker) {
      breaker = await prismaClient.circuitBreaker.create({ data: { service, failureCount: 1, lastFailureTime: new Date() } })
    } else {
      const failCount = breaker.failureCount + 1
      const updateData: any = { failureCount: failCount, lastFailureTime: new Date() }
      if (failCount >= breaker.threshold) {
        updateData.status = 'open'
      }
      breaker = await prismaClient.circuitBreaker.update({ where: { service }, data: updateData })
    }

    return { service: breaker.service, status: breaker.status, failureCount: breaker.failureCount, threshold: breaker.threshold }
  })

  // 记录成功（恢复熔断）
  fastify.post('/api/stability/breaker/success', async (request, reply) => {
    const { service } = request.body as any
    if (!service) return reply.status(400).send({ error: 'service 必填' })

    let breaker = await prismaClient.circuitBreaker.findUnique({ where: { service } })
    if (!breaker) {
      breaker = await prismaClient.circuitBreaker.create({ data: { service, successCount: 1 } })
    } else {
      const successCount = breaker.successCount + 1
      const updateData: any = { successCount, failureCount: 0, lastSuccessTime: new Date() }
      if (breaker.status === 'open' || breaker.status === 'half-open') {
        if (successCount >= 3) { // 连续成功3次恢复
          updateData.status = 'closed'
        } else {
          updateData.status = 'half-open'
        }
      }
      breaker = await prismaClient.circuitBreaker.update({ where: { service }, data: updateData })
    }

    return { service: breaker.service, status: breaker.status, successCount: breaker.successCount }
  })

  // 手动重置熔断器
  fastify.post('/api/stability/breaker/reset', async (request, reply) => {
    const { service } = request.body as any
    await prismaClient.circuitBreaker.upsert({
      where: { service },
      create: { service, status: 'closed', failureCount: 0, successCount: 0 },
      update: { status: 'closed', failureCount: 0, successCount: 0 },
    })
    return { service, status: 'closed' }
  })

  // ============================================
  // GPU Node & GPU Task
  // ============================================

  // GPU 节点状态
  fastify.get('/api/stability/gpu/nodes', async (_request, reply) => {
    const nodes = await prismaClient.gPUNode.findMany()
    return nodes.map(n => ({
      id: n.id, name: n.name, type: n.type, status: n.status,
      load: n.currentLoad, queueDepth: n.queueDepth, temperature: n.temperature,
      lastHeartbeat: n.lastHeartbeat,
    }))
  })

  // 注册/更新 GPU 节点
  fastify.post('/api/stability/gpu/node/heartbeat', async (request, reply) => {
    const { id, name, type, status, currentLoad, queueDepth, temperature } = request.body as any
    const node = await prismaClient.gPUNode.upsert({
      where: { id },
      create: { id, name: name || 'unknown', type: type || 'unknown', status: status || 'online', currentLoad: currentLoad || 0, queueDepth: queueDepth || 0, temperature: temperature || 0 },
      update: { status, currentLoad, queueDepth, temperature, lastHeartbeat: new Date() },
    })
    return { id: node.id, status: node.status }
  })

  // GPU 限流状态
  fastify.get('/api/stability/gpu/throttle', async (_request, reply) => {
    const states = await prismaClient.gPUThrottleState.findMany()
    return states
  })

  // ============================================
  // Worker Heartbeat
  // ============================================

  fastify.post('/api/stability/worker/heartbeat', async (request, reply) => {
    const { workerId, type, status, currentTasks } = request.body as any
    let existing = await prismaClient.workerHeartbeat.findFirst({ where: { workerId } })
    let hb
    if (existing) {
      hb = await prismaClient.workerHeartbeat.update({
        where: { id: existing.id },
        data: { status, currentTasks, heartbeatAt: new Date(), lastActiveAt: new Date() },
      })
    } else {
      hb = await prismaClient.workerHeartbeat.create({
        data: { workerId: workerId || `worker_${Date.now()}`, type: type || 'llm', status: status || 'online', currentTasks: currentTasks || 0 },
      })
    }
    return { workerId: hb.workerId, heartbeatAt: hb.heartbeatAt }
  })

  // 获取所有 Worker 心跳
  fastify.get('/api/stability/workers', async (_request, reply) => {
    const workers = await prismaClient.workerHeartbeat.findMany({ orderBy: { heartbeatAt: 'desc' } })
    const now = Date.now()
    return workers.map(w => ({
      workerId: w.workerId, type: w.type, status: w.status,
      currentTasks: w.currentTasks,
      alive: (now - w.heartbeatAt.getTime()) < 30000, // 30秒内有心跳
      heartbeatAt: w.heartbeatAt,
    }))
  })

  // ============================================
  // System Monitor
  // ============================================

  fastify.post('/api/stability/metrics/report', async (request, reply) => {
    const metrics = request.body as any
    await prismaClient.systemMonitor.create({
      data: {
        cpuUsage: metrics.cpuUsage || 0,
        gpuUsage: metrics.gpuUsage || 0,
        memoryUsage: metrics.memoryUsage || 0,
        queueDepth: metrics.queueDepth || 0,
        llmRequestsPerSec: metrics.llmRequestsPerSec || 0,
        errorRate: metrics.errorRate || 0,
      },
    })
    return { success: true }
  })

  fastify.get('/api/stability/metrics', async (_request, reply) => {
    const metrics = await prismaClient.systemMonitor.findMany({
      orderBy: { timestamp: 'desc' }, take: 60,
    })
    return metrics.map(m => ({
      cpu: m.cpuUsage, gpu: m.gpuUsage, memory: m.memoryUsage,
      queueDepth: m.queueDepth, llmRps: m.llmRequestsPerSec,
      errorRate: m.errorRate, time: m.timestamp,
    }))
  })

  // ============================================
  // User Limits
  // ============================================

  fastify.get('/api/stability/user-limits/:userId', async (request, reply) => {
    const { userId } = request.params as any
    let limits = await prismaClient.userLimit.findUnique({ where: { userId } })
    if (!limits) {
      limits = await prismaClient.userLimit.create({ data: { userId } })
    }
    return limits
  })

  fastify.put('/api/stability/user-limits/:userId', async (request, reply) => {
    const { userId } = request.params as any
    const body = request.body as any
    const limits = await prismaClient.userLimit.upsert({
      where: { userId },
      create: { userId, ...body },
      update: body,
    })
    return limits
  })

  // ============================================
  // 健康总览
  // ============================================

  fastify.get('/api/stability/health', async (_request, reply) => {
    const [queueStats, breakerStats, gpuNodes, workerCount] = await Promise.all([
      Promise.all([
        prismaClient.taskQueue.count({ where: { status: 'pending' } }),
        prismaClient.taskQueue.count({ where: { status: 'running' } }),
        prismaClient.taskQueue.count({ where: { status: 'failed' } }),
      ]),
      prismaClient.circuitBreaker.findMany({ select: { service: true, status: true, failureCount: true, threshold: true } }),
      prismaClient.gPUNode.findMany({ select: { id: true, name: true, status: true, currentLoad: true } }),
      prismaClient.workerHeartbeat.count({ where: { status: { not: 'offline' } } }),
    ])

    return {
      status: breakerStats.some(b => b.status === 'open') ? 'degraded' : 'healthy',
      queue: { pending: queueStats[0], running: queueStats[1], failed: queueStats[2] },
      circuitBreakers: breakerStats,
      gpuNodes: gpuNodes.map(n => ({ id: n.id, name: n.name, status: n.status, load: n.currentLoad })),
      activeWorkers: workerCount,
    }
  })
}
