import { prisma, getRouteConfig } from '../utils/index.js'

// ====== 从 RouteConfig 读取魔数（模块级缓存） ======

let _magicNumbers: Record<string, number> | null = null
let _latencyThresholds: Record<string, number> | null = null

async function ensureConfigsLoaded() {
  if (!_magicNumbers) {
    _magicNumbers = await getRouteConfig('route:ai-router-service', 'magic_numbers', {
      initialConfidence: 0.95,
      defaultLatencyScore: 0.9,
      defaultCostScore: 0.9,
      loadRatioThreshold: 0.8,
      loadPenaltyMultiplier: 0.5,
    })
  }
  if (!_latencyThresholds) {
    _latencyThresholds = await getRouteConfig('route:ai-router-service', 'latency_thresholds', {
      video: 120,
      image: 20,
      tts: 5,
      default: 10,
    })
  }
}

/** 初始化配置（在应用启动时调用一次） */
export async function initAiRouterConfigs() {
  await ensureConfigsLoaded()
}

function getMagic(key: string, fallback: number): number {
  return _magicNumbers?.[key] ?? fallback
}

function getLatencyThreshold(type: string): number {
  return _latencyThresholds?.[type] ?? _latencyThresholds?.['default'] ?? 10
}

// ============================================================
// AI Model Router V1 — 智能决策层（AI Execution Brain）
// ============================================================
//
// 职责：决定"用什么模型做"
// - Model Registry 管理
// - Model Scoring（成本×权重 + 质量×权重 + 延迟×权重 + 成功率×权重）
// - 智能路由选择
// - Fallback 链执行
// - 成本核算
// - 调用日志

interface RouterOptions {
  taskId: string
  projectId?: string
  taskType: string
  policyName?: string   // "cost_first" | "quality_first" | "balanced" | "low_latency"
  maxCost?: number       // 成本上限（USD）
  maxLatency?: number    // 最大延迟容忍（秒）
  preferFallback?: boolean // 是否走 fallback 链
}

interface RouterResult {
  modelId: string
  modelName: string
  provider: string
  score: number
  policyUsed: string
  estimatedCost: number
}

interface ExecutionReport {
  success: boolean
  latency: number
  cost: number
  tokensInput?: number
  tokensOutput?: number
  error?: string
}

export const aiRouter = {
  // ==========================================================
  // ① 模型评分引擎
  // ==========================================================

  /**
   * 对单个模型计算路由分数
   */
  scoreModel(model: any, policy: any): number {
    // 如果模型不可用，返回最低分
    if (model.status !== 'active') return -1

    const totalExecutions = model.successCount + model.failureCount
    const successRate = totalExecutions > 0
      ? model.successCount / totalExecutions
      : getMagic('initialConfidence', 0.95) // 初始未使用模型给 95% 置信度

    // 延迟评分：越低越好，阈值设定为该类模型典型值
    const latencyThreshold = getLatencyThreshold(model.modelType)
    const latencyScore = model.avgLatency > 0
      ? Math.max(0, 1 - (model.avgLatency / latencyThreshold))
      : getMagic('defaultLatencyScore', 0.9)

    // 成本评分：越低越好
    const costScore = model.costPerRequest > 0
      ? Math.max(0, 1 - (model.costPerRequest / 1))
      : getMagic('defaultCostScore', 0.9)

    // 质量评分：直接使用配置值
    const qualityScore = model.qualityScore

    // 负载评分：当前负载越低越好
    const loadScore = model.concurrencyMax > 0
      ? Math.max(0, 1 - (model.currentLoad / model.concurrencyMax))
      : 1

    // 加权总分
    const score =
      (costScore * policy.weightCost) +
      (qualityScore * policy.weightQuality) +
      (latencyScore * policy.weightLatency) +
      (successRate * policy.weightSuccess)

    // 负载惩罚（当负载 > 80% 时额外扣分）
    const loadRatio = model.concurrencyMax > 0 ? model.currentLoad / model.concurrencyMax : 0
    const loadPenalty = loadRatio > getMagic('loadRatioThreshold', 0.8) ? (loadRatio - getMagic('loadRatioThreshold', 0.8)) * getMagic('loadPenaltyMultiplier', 0.5) : 0

    return Math.round((score - loadPenalty) * 100) / 100
  },

  // ==========================================================
  // ② 路由选择
  // ==========================================================

  /**
   * 选择最优模型
   */
  async select(options: RouterOptions): Promise<RouterResult | null> {
    const { taskType, policyName, maxCost, maxLatency } = options

    // 获取策略
    let policy
    if (policyName) {
      policy = await prisma.aiRoutingPolicy.findUnique({ where: { name: policyName } })
    }
    if (!policy) {
      policy = await prisma.aiRoutingPolicy.findFirst({ where: { isDefault: true } })
    }
    if (!policy) {
      console.error('No routing policy found')
      return null
    }

    // 通过 taskType 找合适模型
    const typeMapping = await prisma.aiTaskTypeMapping.findUnique({ where: { taskType } })
    if (!typeMapping || typeMapping.modelIds.length === 0) {
      console.error(`No model mapping for task type: ${taskType}`)
      return null
    }

    // 获取候选模型
    const models = await prisma.aiModel.findMany({
      where: {
        name: { in: typeMapping.modelIds },
        status: 'active',
      },
    })

    if (models.length === 0) return null

    // 评分 + 筛选
    let best: { model: any; score: number } | null = null
    for (const model of models) {
      // 成本上限过滤
      if (maxCost !== undefined && model.costPerRequest > maxCost) continue
      // 延迟上限过滤（仅对历史有数据的模型）
      if (maxLatency !== undefined && model.avgLatency > 0 && model.avgLatency > maxLatency) continue

      const score = this.scoreModel(model, policy)
      if (score < 0) continue

      if (!best || score > best.score) {
        best = { model, score }
      }
    }

    if (!best) return null

    return {
      modelId: best.model.id,
      modelName: best.model.name,
      provider: best.model.provider,
      score: best.score,
      policyUsed: policy.name,
      estimatedCost: best.model.costPerRequest,
    }
  },

  // ==========================================================
  // ③ Fallback 链执行
  // ==========================================================

  /**
   * 获取 fallback 链
   */
  async getFallbackChain(taskType: string, failedModelId: string): Promise<RouterResult[]> {
    const rules = await prisma.aiFallbackRule.findMany({
      where: {
        taskType,
        primaryId: failedModelId,
      },
      orderBy: { priority: 'asc' },
      include: {
        fallback: true,
      },
    })

    const results: RouterResult[] = []
    for (const rule of rules) {
      if (rule.fallback.status !== 'active') continue
      results.push({
        modelId: rule.fallback.id,
        modelName: rule.fallback.name,
        provider: rule.fallback.provider,
        score: rule.fallback.qualityScore,
        policyUsed: 'fallback',
        estimatedCost: rule.fallback.costPerRequest,
      })
    }

    return results
  },

  // ==========================================================
  // ④ 执行一个路由请求（含 fallback 自动降级）
  // ==========================================================

  /**
   * 执行一个 AI 调用（选模型 → fallback 降级 → 计费）
   * 
   * 调用者需要传入 executor 函数来实际调用 API
   */
  async execute(
    options: RouterOptions,
    executor: (modelId: string, modelName: string, provider: string) => Promise<ExecutionReport>
  ): Promise<{
    success: boolean
    result?: RouterResult
    executionLog?: any
    fallbacksTried: number
    totalCost: number
  }> {
    const { taskId, projectId, taskType } = options

    // 第一步：选模型
    const selection = await this.select(options)
    if (!selection) {
      await this.logExecution({
        taskId, projectId, taskType,
        modelId: 'none',
        status: 'failed',
        latency: 0, cost: 0,
        error: 'No model available',
        policyUsed: 'none',
      })
      return { success: false, fallbacksTried: 0, totalCost: 0 }
    }

    let currentSelection = selection
    let fallbacksTried = 0

    // 执行前先占位负载
  await prisma.aiModel.update({
    where: { id: currentSelection.modelId },
    data: { currentLoad: { increment: 1 } },
  })

  while (currentSelection) {
      // 记录调用前评分
      const scoreBefore = currentSelection.score

      try {
        const report = await executor(
          currentSelection.modelId,
          currentSelection.modelName,
          currentSelection.provider
        )

        // 记录日志
        await this.logExecution({
          taskId, projectId, taskType,
          modelId: currentSelection.modelId,
          status: report.success ? 'success' : 'failed',
          latency: report.latency,
          cost: report.cost,
          tokensInput: report.tokensInput,
          tokensOutput: report.tokensOutput,
          error: report.error,
          policyUsed: currentSelection.policyUsed,
          scoreBefore,
          scoreAfter: scoreBefore, // 后续异步更新
        })

        // 更新模型统计
        await this.updateModelStats(currentSelection.modelId, report)

        if (report.success) {
          return {
            success: true,
            result: currentSelection,
            executionLog: report,
            fallbacksTried,
            totalCost: report.cost,
          }
        }

        // 失败 → 尝试 fallback
        const fallbackChain = await this.getFallbackChain(taskType, currentSelection.modelId)
        if (fallbackChain.length === 0) break

        currentSelection = fallbackChain[0]
        fallbacksTried++
      } catch (err) {
        const errorMsg = String(err)
        await this.logExecution({
          taskId, projectId, taskType,
          modelId: currentSelection.modelId,
          status: 'failed',
          latency: 0, cost: 0,
          error: errorMsg,
          policyUsed: currentSelection.policyUsed,
          scoreBefore,
          scoreAfter: scoreBefore,
        })

        const fallbackChain = await this.getFallbackChain(taskType, currentSelection.modelId)
        if (fallbackChain.length === 0) break

        currentSelection = fallbackChain[0]
        fallbacksTried++
      }
    }

    // 所有模型都失败了
    await this.logExecution({
      taskId, projectId, taskType,
      modelId: 'exhausted',
      status: 'failed',
      latency: 0, cost: 0,
      error: `All models exhausted after ${fallbacksTried} fallbacks`,
      policyUsed: 'exhausted',
    })
    return { success: false, fallbacksTried, totalCost: 0 }
  },

  // ==========================================================
  // ⑤ 日志 & 统计
  // ==========================================================

  async logExecution(params: {
    taskId: string
    projectId?: string
    taskType: string
    modelId: string
    status: string
    latency: number
    cost: number
    tokensInput?: number
    tokensOutput?: number
    error?: string
    policyUsed?: string
    scoreBefore?: number
    scoreAfter?: number
    requestType?: string
  }) {
    return await prisma.aiExecutionLog.create({
      data: {
        taskId: params.taskId,
        projectId: params.projectId,
        modelId: params.modelId,
        taskType: params.taskType,
        requestType: params.requestType ?? 'api',
        status: params.status,
        latency: params.latency,
        cost: params.cost,
        tokensInput: params.tokensInput,
        tokensOutput: params.tokensOutput,
        error: params.error,
        policyUsed: params.policyUsed,
        scoreBefore: params.scoreBefore,
        scoreAfter: params.scoreAfter,
      },
    })
  },

  async updateModelStats(modelId: string, report: ExecutionReport) {
    const model = await prisma.aiModel.findUnique({ where: { id: modelId } })
    if (!model) return

    const totalExecutions = model.successCount + model.failureCount + 1
    const newSuccessCount = model.successCount + (report.success ? 1 : 0)
    const newFailureCount = model.failureCount + (report.success ? 0 : 1)

    // 滑动平均延迟
    const newAvgLatency = totalExecutions === 1
      ? report.latency
      : (model.avgLatency * (totalExecutions - 1) + report.latency) / totalExecutions

    await prisma.aiModel.update({
      where: { id: modelId },
      data: {
        successCount: newSuccessCount,
        failureCount: newFailureCount,
        avgLatency: newAvgLatency,
        totalCost: { increment: report.cost },
        currentLoad: { decrement: 1 },
      },
    })
  },

  // ==========================================================
  // ⑥ 管理接口
  // ==========================================================

  async getModelRegistry() {
    return await prisma.aiModel.findMany({
      orderBy: [{ modelType: 'asc' }, { name: 'asc' }],
    })
  },

  async getExecutionHistory(limit: number = 50) {
    return await prisma.aiExecutionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },

  async getCostSummary(projectId?: string) {
    const where = projectId ? { projectId } : {}

    const logs = await prisma.aiExecutionLog.groupBy({
      by: ['modelId', 'taskType', 'status'],
      where,
      _sum: { cost: true },
      _count: { id: true },
    })

    return logs.map(l => ({
      modelId: l.modelId,
      taskType: l.taskType,
      status: l.status,
      totalCost: l._sum.cost ?? 0,
      count: l._count.id,
    }))
  },

  async updateModelStatus(modelId: string, status: string) {
    return await prisma.aiModel.update({
      where: { id: modelId },
      data: { status },
    })
  },
}
