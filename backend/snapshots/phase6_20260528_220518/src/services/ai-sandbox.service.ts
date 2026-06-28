import { prisma } from '../utils/index.js'

// ============================================================
// AI Model Sandbox V1 — 真实世界适配层（Reality Layer）
// ============================================================
//
// 职责：保护系统不被真实AI API的不稳定性打穿
//
// - Circuit Breaker（熔断器）：自动开/合
// - Timeout 统一管理
// - Cost Guard（成本防护）
// - Rate Limiting
// - Output Validation
// - 统一的执行沙箱

interface SandboxOptions {
  taskId: string
  projectId?: string
  userId?: string
  taskType: string
  modelName: string
  requestType: string         // chat_completion / image_gen / video_gen / tts
  promptPreview?: string
  timeoutOverride?: number    // 可选覆盖超时
  budgetCheck?: boolean       // 是否检查预算，默认 true
}

interface SandboxResult {
  success: boolean
  data?: any
  status: 'success' | 'timeout' | 'circuit_breaker' | 'rate_limited' | 'budget_exceeded' | 'failed'
  latencyMs: number
  retryCount: number
  error?: string
  errorType?: string
  cost: number
}

// 熔断状态
type BreakerState = 'closed' | 'open' | 'half-open'

export const sandbox = {
  // ==========================================================
  // ① Circuit Breaker — 熔断器
  // ==========================================================

  /**
   * 检查熔断状态
   */
  async checkBreaker(modelName: string): Promise<{ allowed: boolean; state: BreakerState; reason?: string }> {
    let breaker = await prisma.aiCircuitBreaker.findUnique({
      where: { modelId: modelName },
    })

    if (!breaker) {
      // 首次使用，自动创建熔断器
      breaker = await prisma.aiCircuitBreaker.create({
        data: { modelId: modelName },
      })
    }

    if (breaker.state === 'open') {
      // 检查是否过了冷却期
      const elapsed = Date.now() - (breaker.openedAt?.getTime() ?? 0)
      if (elapsed >= breaker.resetTimeoutMs) {
        // 半开：允许一次试探请求
        await prisma.aiCircuitBreaker.update({
          where: { id: breaker.id },
          data: { state: 'half-open', halfOpenAt: new Date() },
        })
        return { allowed: true, state: 'half-open' }
      }
      return {
        allowed: false,
        state: 'open',
        reason: `Circuit breaker open for ${modelName}, ${Math.round((breaker.resetTimeoutMs - elapsed) / 1000)}s remaining`,
      }
    }

    return { allowed: true, state: breaker.state as BreakerState }
  },

  /**
   * 记录调用结果到熔断器
   */
  async recordBreakerResult(modelName: string, success: boolean, errorType?: string) {
    const breaker = await prisma.aiCircuitBreaker.findUnique({
      where: { modelId: modelName },
    })
    if (!breaker) return

    const now = new Date()

    if (success) {
      const newSuccessCount = breaker.successCount + 1
      const updates: any = {
        successCount: newSuccessCount,
        lastSuccessAt: now,
        failureCount: 0, // 成功后重置连续失败
      }

      // 半开状态：连续成功达到阈值 → 关闭
      if (breaker.state === 'half-open' && newSuccessCount >= breaker.successThreshold) {
        updates.state = 'closed'
        updates.successCount = 0
      }

      await prisma.aiCircuitBreaker.update({
        where: { id: breaker.id },
        data: updates,
      })
    } else {
      const newFailureCount = breaker.failureCount + 1
      const updates: any = {
        failureCount: newFailureCount,
        lastFailureAt: now,
        lastError: `${errorType ?? 'unknown'}`,
        successCount: 0,
      }

      // 连续失败达到阈值 → 熔断开启
      if (newFailureCount >= breaker.failureThreshold) {
        updates.state = 'open'
        updates.openedAt = now
      }

      await prisma.aiCircuitBreaker.update({
        where: { id: breaker.id },
        data: updates,
      })
    }
  },

  // ==========================================================
  // ② Cost Guard — 成本防护
  // ==========================================================

  /**
   * 检查预算是否超限
   */
  async checkBudget(options: {
    projectId?: string
    userId?: string
    estimatedCost: number
  }): Promise<{ allowed: boolean; reason?: string }> {
    const { projectId, userId, estimatedCost } = options

    // 项目预算检查
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (project?.budgetLimit !== null && project?.budgetLimit !== undefined) {
        const spent = project.budgetSpent ?? 0
        if (spent + estimatedCost > project.budgetLimit) {
          return { allowed: false, reason: `Project budget exceeded: ${spent} + ${estimatedCost} > ${project.budgetLimit}` }
        }
        // 预算告警（80%）
        if (!project.budgetNotified && project.budgetAlertAt !== null && project.budgetAlertAt !== undefined) {
          const ratio = (spent / project.budgetLimit) * 100
          if (ratio >= project.budgetAlertAt) {
            // 标记已通知
            await prisma.project.update({
              where: { id: projectId },
              data: { budgetNotified: true },
            })
            console.warn(`⚠️ Project ${projectId} budget alert: ${ratio.toFixed(1)}% used`)
          }
        }
      }
    }

    // 用户月度预算检查
    if (userId) {
      const membership = await prisma.membership.findFirst({ where: { userId } })
      if (membership?.monthlyBudget !== null && membership?.monthlyBudget !== undefined) {
        if ((membership.monthlySpent ?? 0) + estimatedCost > membership.monthlyBudget) {
          return { allowed: false, reason: `User monthly budget exceeded` }
        }
      }
    }

    return { allowed: true }
  },

  /**
   * 记录成本花费
   */
  async recordCost(options: {
    projectId?: string
    userId?: string
    cost: number
  }) {
    const { projectId, userId, cost } = options

    if (projectId) {
      await prisma.project.update({
        where: { id: projectId },
        data: { budgetSpent: { increment: cost } },
      })
    }

    if (userId) {
      await prisma.membership.updateMany({
        where: { userId },
        data: { monthlySpent: { increment: cost } },
      })
    }
  },

  // ==========================================================
  // ③ 获取超时配置
  // ==========================================================

  async getTimeoutConfig(taskType: string): Promise<{
    timeoutMs: number
    retryCount: number
    retryDelayMs: number
  }> {
    const config = await prisma.aiTimeoutConfig.findUnique({
      where: { taskType },
    })
    return {
      timeoutMs: config?.timeoutMs ?? 30000,
      retryCount: config?.retryCount ?? 2,
      retryDelayMs: config?.retryDelayMs ?? 1000,
    }
  },

  // ==========================================================
  // ④ 输出验证
  // ==========================================================

  validateOutput(requestType: string, data: any): { valid: boolean; error?: string } {
    if (!data) {
      return { valid: false, error: 'Empty response' }
    }

    switch (requestType) {
      case 'chat_completion':
        if (typeof data === 'string') return { valid: true }
        if (data.content && typeof data.content === 'string') return { valid: true }
        return { valid: false, error: 'Invalid chat completion format' }

      case 'image_gen':
        if (data.imageUrl || data.images || data.data?.[0]?.b64_json) return { valid: true }
        return { valid: false, error: 'Invalid image generation format' }

      case 'video_gen':
        if (data.videoUrl || data.url || data.taskId) return { valid: true }
        return { valid: false, error: 'Invalid video generation format' }

      case 'tts':
        if (data.audioUrl || data.audio || data.data) return { valid: true }
        return { valid: false, error: 'Invalid TTS format' }

      default:
        return { valid: true }
    }
  },

  // ==========================================================
  // ⑤ 统一执行沙箱（核心入口）
  // ==========================================================

  /**
   * 在沙箱中执行一次 AI 调用
   * 自动处理：限流 → 熔断 → 超时 → 重试 → 计费
   */
  async execute(
    options: SandboxOptions,
    executor: (signal: AbortSignal) => Promise<{ data: any; latencyMs: number; cost: number; tokens?: number; responsePreview?: string }>
  ): Promise<SandboxResult> {
    const { taskId, projectId, userId, taskType, modelName, requestType, promptPreview, timeoutOverride, budgetCheck } = options

    // ① 熔断检查
    const breaker = await this.checkBreaker(modelName)
    if (!breaker.allowed) {
      await this.logSandboxCall({
        executionLogId: taskId,
        modelName,
        requestType,
        status: 'circuit_breaker',
        latencyMs: 0,
        timeoutMs: timeoutOverride ?? 30000,
        retryCount: 0,
        errorType: 'circuit_breaker',
        errorDetail: breaker.reason,
        cost: 0,
      })
      return {
        success: false,
        status: 'circuit_breaker',
        latencyMs: 0,
        retryCount: 0,
        error: breaker.reason,
        errorType: 'circuit_breaker',
        cost: 0,
      }
    }

    // ② 获取超时配置
    const timeoutConfig = await this.getTimeoutConfig(taskType)
    const timeoutMs = timeoutOverride ?? timeoutConfig.timeoutMs

    // ③ 预算检查
    if (budgetCheck !== false && (projectId || userId)) {
      const fixedEstimatedCost = 0.001 // 最小估算成本
      const budgetCheckResult = await this.checkBudget({
        projectId,
        userId,
        estimatedCost: fixedEstimatedCost,
      })
      if (!budgetCheckResult.allowed) {
        await this.logSandboxCall({
          executionLogId: taskId,
          modelName,
          requestType,
          status: 'budget_exceeded',
          latencyMs: 0,
          timeoutMs,
          retryCount: 0,
          errorType: 'budget_exceeded',
          errorDetail: budgetCheckResult.reason,
          cost: 0,
        })
        return {
          success: false,
          status: 'budget_exceeded',
          latencyMs: 0,
          retryCount: 0,
          error: budgetCheckResult.reason,
          errorType: 'budget_exceeded',
          cost: 0,
        }
      }
    }

    // ④ 执行（含重试）
    let lastError: string | undefined
    let lastErrorType: string | undefined
    let totalCost = 0
    let retriesUsed = 0

    for (let attempt = 0; attempt <= timeoutConfig.retryCount; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      const startTime = Date.now()

      try {
        const result = await executor(controller.signal)
        clearTimeout(timeoutId)
        const actualLatency = Date.now() - startTime

        // 输出验证
        const validation = this.validateOutput(requestType, result.data)
        if (!validation.valid) {
          throw new Error(`Output validation failed: ${validation.error}`)
        }

        totalCost = result.cost

        // 记录沙箱日志
        await this.logSandboxCall({
          executionLogId: taskId,
          modelName,
          requestType,
          status: 'success',
          latencyMs: result.latencyMs,
          timeoutMs,
          retryCount: attempt,
          tokenCount: result.tokens,
          promptPreview: promptPreview?.slice(0, 200),
          responsePreview: result.responsePreview?.slice(0, 200),
          cost: result.cost,
        })

        // 熔断器记录成功
        await this.recordBreakerResult(modelName, true)

        // 记录成本
        await this.recordCost({ projectId, userId, cost: result.cost })

        return {
          success: true,
          data: result.data,
          status: 'success',
          latencyMs: result.latencyMs,
          retryCount: attempt,
          cost: result.cost,
        }
      } catch (err: any) {
        clearTimeout(timeoutId)
        const actualLatency = Date.now() - startTime

        if (err.name === 'AbortError') {
          lastError = `Timeout after ${timeoutMs}ms`
          lastErrorType = 'timeout'
        } else if (err.message?.includes('rate limit') || err.message?.includes('429')) {
          lastError = err.message
          lastErrorType = 'rate_limit'
          // rate limit 等待再重试
          await new Promise(r => setTimeout(r, timeoutConfig.retryDelayMs * (attempt + 1)))
        } else if (err.message?.includes('auth') || err.message?.includes('401') || err.message?.includes('403')) {
          lastError = `Auth error: ${err.message}`
          lastErrorType = 'auth_error'
          break // 认证错误不重试
        } else {
          lastError = err.message ?? String(err)
          lastErrorType = 'server_error'
          await new Promise(r => setTimeout(r, timeoutConfig.retryDelayMs))
        }

        retriesUsed = attempt + 1
      }
    }

    // 所有重试耗尽
    await this.logSandboxCall({
      executionLogId: taskId,
      modelName,
      requestType,
      status: 'failed',
      latencyMs: 0,
      timeoutMs,
      retryCount: retriesUsed,
      errorType: lastErrorType,
      errorDetail: lastError,
      cost: 0,
    })

    // 熔断器记录失败
    await this.recordBreakerResult(modelName, false, lastErrorType)

    return {
      success: false,
      status: retriesUsed > 0 ? 'timeout' : 'failed',
      latencyMs: 0,
      retryCount: retriesUsed,
      error: lastError,
      errorType: lastErrorType,
      cost: totalCost,
    }
  },

  // ==========================================================
  // ⑥ 日志辅助
  // ==========================================================

  async logSandboxCall(params: {
    executionLogId: string
    modelName: string
    requestType: string
    status: string
    latencyMs: number
    timeoutMs: number
    retryCount: number
    tokenCount?: number
    promptPreview?: string
    responsePreview?: string
    errorType?: string
    errorDetail?: string
    cost: number
  }) {
    await prisma.aiSandboxLog.create({
      data: {
        executionLogId: params.executionLogId,
        modelName: params.modelName,
        requestType: params.requestType,
        status: params.status,
        latencyMs: params.latencyMs,
        timeoutMs: params.timeoutMs,
        retryCount: params.retryCount,
        tokenCount: params.tokenCount,
        promptPreview: params.promptPreview,
        responsePreview: params.responsePreview,
        errorType: params.errorType,
        errorDetail: params.errorDetail,
        cost: params.cost,
      },
    })
  },

  // ==========================================================
  // ⑦ 管理接口
  // ==========================================================

  async getBreakerStatus() {
    return await prisma.aiCircuitBreaker.findMany({
      orderBy: { modelId: 'asc' },
    })
  },

  async resetBreaker(modelName: string) {
    return await prisma.aiCircuitBreaker.update({
      where: { modelId: modelName },
      data: {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        openedAt: null,
        halfOpenAt: null,
        lastError: null,
      },
    })
  },

  async getSandboxLogs(limit: number = 50) {
    return await prisma.aiSandboxLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },

  async getCostStats() {
    const logs = await prisma.aiSandboxLog.groupBy({
      by: ['status'],
      _sum: { cost: true },
      _count: { id: true },
    })

    return logs.map(l => ({
      status: l.status,
      totalCost: l._sum.cost ?? 0,
      count: l._count.id,
    }))
  },
}

export { BreakerState }
