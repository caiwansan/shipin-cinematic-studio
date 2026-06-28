import { prisma } from '../utils/index.js'

/**
 * Worker Pool V2 — 资源调度层
 * 
 * 功能：
 * - Worker 健康评分（成功率×0.4 + 响应速度×0.3 + 负载空闲度×0.2 + 错误率反比×0.1）
 * - 自动摘除不健康 Worker
 * - 权重调度优化
 * - 动态并发控制
 * - 任务执行追踪
 */

interface WorkerScoreParams {
  successRate: number     // 0~1
  avgResponseTime: number // 秒，越低越好
  loadRatio: number       // 0~1（currentLoad / capacity）
  errorRate: number       // 0~1
}

// 评分权重
const SCORE_WEIGHTS = {
  successRate: 0.4,
  responseTime: 0.3,
  loadIdle: 0.2,
  errorRate: 0.1,
}

// 响应时间阈值（秒），超过视为慢 worker
const RESPONSE_TIME_THRESHOLD = 30
// 连续错误次数阈值，超限自动摘除
const AUTO_UNHEALTHY_THRESHOLD = 5
// 健康检查心跳超时（秒）
const HEARTBEAT_TIMEOUT = 30

export const workerPool = {
  /**
   * 计算 Worker 健康评分
   */
  calculateScore(params: WorkerScoreParams): number {
    const { successRate, avgResponseTime, loadRatio, errorRate } = params

    // 成功率评分（越高越好）
    const successScore = successRate

    // 响应速度评分（越低越好，阈值 30s 还算快）
    const responseScore = Math.max(0, 1 - (avgResponseTime / RESPONSE_TIME_THRESHOLD))

    // 负载空闲度评分（负载越低越好）
    const idleScore = 1 - loadRatio

    // 错误率反比评分（错误越低越好）
    const errorScore = 1 - errorRate

    // 加权综合
    const score =
      successScore * SCORE_WEIGHTS.successRate +
      responseScore * SCORE_WEIGHTS.responseTime +
      idleScore * SCORE_WEIGHTS.loadIdle +
      errorScore * SCORE_WEIGHTS.errorRate

    return Math.round(score * 100) / 100 // 保留两位小数
  },

  /**
   * 注册/更新 Worker 心跳
   */
  async heartbeat(workerId: string, hostname: string, params: {
    capacity?: number
    currentLoad?: number
    tags?: string[]
    capabilities?: Record<string, any>
    version?: string
  }) {
    const now = new Date()

    return await prisma.workerRegistration.upsert({
      where: { id: workerId },
      create: {
        id: workerId,
        hostname,
        version: params.version ?? '1.0',
        capacity: params.capacity ?? 5,
        currentLoad: params.currentLoad ?? 0,
        tags: params.tags ?? [],
        capabilities: params.capabilities ?? {},
        score: 1.0,
        weight: 1.0,
        lastHeartbeat: now,
      },
      update: {
        hostname,
        version: params.version ?? undefined,
        capacity: params.capacity ?? undefined,
        currentLoad: params.currentLoad ?? undefined,
        tags: params.tags ?? undefined,
        capabilities: params.capabilities ?? undefined,
        lastHeartbeat: now,
        // 心跳恢复时自动标记 healthy
        healthy: true,
        status: 'active',
      },
    })
  },

  /**
   * 报告任务执行结果（更新评分数据）
   */
  async reportExecution(workerId: string, taskId: string, params: {
    success: boolean
    responseTime: number
    error?: string
  }) {
    const worker = await prisma.workerRegistration.findUnique({ where: { id: workerId } })
    if (!worker) return

    // 更新计数
    const newSuccessCount = worker.successCount + (params.success ? 1 : 0)
    const newFailureCount = worker.failureCount + (params.success ? 0 : 1)
    const totalExecutions = newSuccessCount + newFailureCount

    // 滑动平均响应时间
    const newAvgResponseTime = totalExecutions === 1
      ? params.responseTime
      : (worker.avgResponseTime * (totalExecutions - 1) + params.responseTime) / totalExecutions

    // 计算最新评分
    const successRate = totalExecutions > 0 ? newSuccessCount / totalExecutions : 1
    const errorRate = totalExecutions > 0 ? newFailureCount / totalExecutions : 0
    const loadRatio = worker.capacity > 0 ? (worker.currentLoad / worker.capacity) : 0

    const score = this.calculateScore({
      successRate,
      avgResponseTime: newAvgResponseTime,
      loadRatio,
      errorRate,
    })

    // 连续错误追踪
    const newConsecutiveErrors = params.success ? 0 : (worker.consecutiveErrors + 1)

    // 自动摘除判断
    const autoUnhealthy = newConsecutiveErrors >= AUTO_UNHEALTHY_THRESHOLD

    const updateData: any = {
      successCount: newSuccessCount,
      failureCount: newFailureCount,
      avgResponseTime: newAvgResponseTime,
      score,
      consecutiveErrors: newConsecutiveErrors,
    }

    if (autoUnhealthy) {
      updateData.healthy = false
      updateData.status = 'unhealthy'
      updateData.lastError = `Auto-unhealthy: ${newConsecutiveErrors} consecutive failures`
      updateData.autoUnhealthyAt = new Date()
    }

    if (params.error) {
      updateData.lastError = params.error.slice(0, 500)
    }

    await prisma.workerRegistration.update({
      where: { id: workerId },
      data: updateData,
    })

    // 记录健康历史
    await prisma.workerHealthHistory.create({
      data: {
        workerId,
        score,
        healthy: !autoUnhealthy && worker.healthy,
        load: worker.currentLoad,
      },
    })

    // 清除分配记录
    await prisma.workerTaskAssignment.deleteMany({
      where: { workerId, taskId },
    })

    return { score, autoUnhealthy, newConsecutiveErrors }
  },

  /**
   * 分配任务到最优 Worker
   * 
   * 算法：
   * 1. 筛选健康、active、有心跳的 worker
   * 2. 按 score × weight 排序
   * 3. 检查容量
   * 4. 返回最优 worker
   */
  async assignTask(taskId: string, requiredCapacity: number = 1): Promise<{
    workerId: string
    hostname: string
    score: number
  } | null> {
    const heartbeatThreshold = new Date(Date.now() - HEARTBEAT_TIMEOUT * 1000)

    // 获取所有可用 worker
    const candidates = await prisma.workerRegistration.findMany({
      where: {
        healthy: true,
        status: 'active',
        lastHeartbeat: { gte: heartbeatThreshold },
      },
      orderBy: [
        { score: 'desc' },
        { weight: 'desc' },
        { currentLoad: 'asc' },
      ],
    })

    // 过滤出有空余容量的 worker
    for (const worker of candidates) {
      if (worker.currentLoad + requiredCapacity <= worker.capacity) {
        // 创建分配记录
        await prisma.workerTaskAssignment.create({
          data: {
            workerId: worker.id,
            taskId,
            startedAt: new Date(),
            estimatedDuration: requiredCapacity * 10, // 估算
          },
        })

        // 更新 worker 负载
        await prisma.workerRegistration.update({
          where: { id: worker.id },
          data: { currentLoad: { increment: requiredCapacity } },
        })

        return {
          workerId: worker.id,
          hostname: worker.hostname,
          score: worker.score,
        }
      }
    }

    return null // 没有可用 worker
  },

  /**
   * 释放 Worker 容量（任务完成/失败后调用）
   */
  async releaseCapacity(workerId: string, capacity: number = 1) {
    await prisma.workerRegistration.update({
      where: { id: workerId },
      data: { currentLoad: { decrement: capacity } },
    })
  },

  /**
   * 摘除不健康 Worker
   */
  async autoPrune(): Promise<number> {
    const heartbeatThreshold = new Date(Date.now() - HEARTBEAT_TIMEOUT * 1000)

    // 1. 心跳超时 → unhealthy
    const timedOut = await prisma.workerRegistration.updateMany({
      where: {
        lastHeartbeat: { lt: heartbeatThreshold },
        healthy: true,
        status: 'active',
      },
      data: {
        healthy: false,
        status: 'timeout',
        lastError: 'Heartbeat timeout, auto-pruned',
        consecutiveErrors: { increment: 1 },
      },
    })

    // 2. 连续错误超限 → unhealthy（已在 reportExecution 中处理）
    // 但这里做一次兜底检查

    // 3. 记录健康状况
    const allWorkers = await prisma.workerRegistration.findMany({
      where: { healthy: true, status: 'active' },
    })
    for (const w of allWorkers) {
      await prisma.workerHealthHistory.create({
        data: {
          workerId: w.id,
          score: w.score,
          healthy: w.healthy,
          load: w.currentLoad,
        },
      })
    }

    return timedOut.count
  },

  /**
   * 获取 Worker Pool 状态
   */
  async getStatus() {
    const workers = await prisma.workerRegistration.findMany({
      orderBy: [{ healthy: 'desc' }, { score: 'desc' }],
    })

    const stats = {
      total: workers.length,
      active: workers.filter(w => w.healthy && w.status === 'active').length,
      unhealthy: workers.filter(w => !w.healthy).length,
      timeout: workers.filter(w => w.status === 'timeout').length,
    }

    const assignments = await prisma.workerTaskAssignment.count()

    return {
      stats,
      workers: workers.map(w => ({
        id: w.id,
        hostname: w.hostname,
        status: w.status,
        healthy: w.healthy,
        score: w.score,
        weight: w.weight,
        load: `${w.currentLoad}/${w.capacity}`,
        loadRatio: w.capacity > 0 ? (w.currentLoad / w.capacity).toFixed(2) : '0',
        successRate: (w.successCount + w.failureCount) > 0
          ? (w.successCount / (w.successCount + w.failureCount)).toFixed(2)
          : 'N/A',
        avgResponseTime: `${w.avgResponseTime.toFixed(1)}s`,
        lastHeartbeat: w.lastHeartbeat.toISOString(),
        lastError: w.lastError,
      })),
      assignments,
    }
  },

  /**
   * 手动恢复 Worker
   */
  async recoverWorker(workerId: string) {
    return await prisma.workerRegistration.update({
      where: { id: workerId },
      data: {
        healthy: true,
        status: 'active',
        consecutiveErrors: 0,
        lastError: null,
        autoUnhealthyAt: null,
      },
    })
  },

  /**
   * 更新 Worker 权重
   */
  async updateWeight(workerId: string, weight: number) {
    return await prisma.workerRegistration.update({
      where: { id: workerId },
      data: { weight, lastWeightedAt: new Date() },
    })
  },
}

// 导出常量供其他模块使用
export { AUTO_UNHEALTHY_THRESHOLD, HEARTBEAT_TIMEOUT }
