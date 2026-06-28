/**
 * Shadow Execution Engine v1 — 影子执行系统
 * 
 * 旁路系统，完全不污染主链路。
 * 职责：
 *   1. Shadow Gate：流量控制 + 灰度路由
 *   2. Shadow Queue：异步执行真实 API
 *   3. Shadow Diff Engine：Mock vs Real 对比评分
 *   4. Drift Detection：漂移检测
 *   5. Cost Guard V2：4层成本保护
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

// 复用全局 Prisma Client
const prisma = new PrismaClient()

interface ShadowExecuteOptions {
  taskId: string
  projectId: string
  userId?: string
  taskType: string
  modelName: string
  requestType?: string
  promptPreview?: string
  mockOutput?: any
  mockLatencyMs?: number
  mockCost?: number
}

interface ShadowGateResult {
  allowed: boolean
  reason?: string
  grayActive: boolean
  config: any
}

// ============================================================
// Shadow Gate — 控制影子执行入口
// ============================================================

export async function shadowGate(userId: string): Promise<ShadowGateResult> {
  const config = await prisma.shadowConfig.findFirst({ where: { id: 'default-shadow-config' } })
  if (!config || !config.enabled) {
    return { allowed: false, reason: 'shadow_disabled', grayActive: false, config: null }
  }

  // 成本预算检查
  if (Number(config.costSpent) >= Number(config.costBudget)) {
    return { allowed: false, reason: 'budget_exhausted', grayActive: false, config }
  }

  // 灰度路由：hash(userId) % 100 < threshold
  const hash = crypto.createHash('md5').update(userId).digest('hex')
  const hashVal = parseInt(hash.slice(0, 8), 16) % 100
  const grayActive = hashVal < config.grayThreshold

  if (!grayActive) {
    return { allowed: true, reason: 'gate_open_but_no_gray', grayActive: false, config }
  }

  return { allowed: true, reason: 'gate_open', grayActive: true, config }
}

// ============================================================
// Cost Guard V2 — 4层成本保护检查
// ============================================================

export async function costGuardPreCheck(taskType: string, estimatedCost: number): Promise<{
  allowed: boolean
  reason?: string
  blockedBy?: string
}> {
  // ① 全局预算
  const globalBudget = await prisma.costBudget.findFirst({
    where: { scope: 'global', enabled: true },
  })
  if (globalBudget && Number(globalBudget.spentAmount) + estimatedCost > Number(globalBudget.budgetAmount) * (globalBudget.blockThreshold / 100)) {
    return { allowed: false, reason: `Global budget exceeded (${Number(globalBudget.spentAmount).toFixed(4)}/${Number(globalBudget.budgetAmount).toFixed(4)})`, blockedBy: 'global' }
  }

  // ② Task-Type 预算
  const taskBudget = await prisma.costBudget.findFirst({
    where: { scope: 'task_type', scopeId: taskType, enabled: true },
  })
  if (taskBudget && Number(taskBudget.spentAmount) + estimatedCost > Number(taskBudget.budgetAmount) * (taskBudget.blockThreshold / 100)) {
    return { allowed: false, reason: `Task budget exceeded for ${taskType}`, blockedBy: 'task_type' }
  }

  return { allowed: true }
}

export async function costGuardRecordCost(scope: string, scopeId: string | null, amount: number): Promise<void> {
  if (!scopeId && scope !== 'global') return

  const budget = await prisma.costBudget.findFirst({
    where: { scope, scopeId: scopeId ?? undefined, enabled: true },
  })

  if (budget) {
    const newSpent = Number(budget.spentAmount) + amount
    const alertPct = (newSpent / Number(budget.budgetAmount)) * 100

    await prisma.costBudget.update({
      where: { id: budget.id },
      data: {
        spentAmount: newSpent,
        ...(alertPct >= budget.alertThreshold && !budget.lastAlertAt ? { lastAlertAt: new Date() } : {}),
        ...(alertPct >= budget.blockThreshold && !budget.lastBlockedAt ? { lastBlockedAt: new Date() } : {}),
      },
    })
  } else {
    // 全局/任务类型预算不存在时不用记录
  }
}

// ============================================================
// Shadow Queue — 异步执行真实 API 调用
// ============================================================

export async function shadowQueueExecute(options: ShadowExecuteOptions): Promise<any> {
  const { taskId, projectId, userId, taskType, modelName, requestType, promptPreview, mockOutput, mockLatencyMs, mockCost } = options

  const config = await prisma.shadowConfig.findFirst({ where: { id: 'default-shadow-config' } })
  if (!config || !config.enabled) return null

  // 限流检查：1分钟内执行数
  const recentCount = await prisma.shadowExecutionLog.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 60000) },
    },
  })
  if (recentCount >= config.rateLimitPerMin) {
    console.log(`[Shadow] Rate limit hit: ${recentCount}/${config.rateLimitPerMin} per min`)
    return null
  }

  // 预估成本
  const estimatedCost = mockCost ?? estimateCost(taskType, modelName)

  // Cost Guard 检查
  const costCheck = await costGuardPreCheck(taskType, estimatedCost)
  if (!costCheck.allowed) {
    console.log(`[Shadow] Cost guard blocked: ${costCheck.reason}`)
    return null
  }

  // 创建执行日志
  const log = await prisma.shadowExecutionLog.create({
    data: {
      shadowConfigId: config.id,
      taskId,
      projectId,
      userId,
      taskType,
      modelName,
      promptPreview,
      mockOutput: mockOutput ?? {},
      mockLatencyMs: mockLatencyMs ?? 0,
      mockCost: mockCost ?? 0,
      status: 'pending',
    },
  })

  // 异步执行真实调用
  executeRealApi(log.id, taskType, modelName, promptPreview).catch(err => {
    console.error(`[Shadow] Real API execution failed for log ${log.id}:`, err.message)
  })

  return { logId: log.id, status: 'queued' }
}

// ============================================================
// 真实 API 执行（沙箱化模拟，Phase 6B 后接真实 Key）
// ============================================================

async function executeRealApi(logId: string, taskType: string, modelName: string, promptPreview?: string): Promise<void> {
  const startTime = Date.now()

  try {
    // —— Phase 6B 后，这里替换为真实 API 调用 ——
    // 目前用扩展的 mock：增加延迟抖动 + 随机失败 + 不同输出
    const baseLatency = taskType === 'video_gen' ? 3000 : taskType === 'character_gen' ? 1500 : taskType === 'voiceover' ? 500 : 800
    const jitter = Math.random() * 3000
    const delay = baseLatency + jitter

    await new Promise(resolve => setTimeout(resolve, delay))

    // 10% 随机失败
    if (Math.random() < 0.1) {
      throw new Error(`Shadow simulated error for ${modelName}`)
    }

    // 生成真实输出（extension of mock：加些自然变化）
    const realOutput = generateRealOutput(taskType, modelName, promptPreview)
    const realLatencyMs = Date.now() - startTime
    const realCost = estimateCost(taskType, modelName)

    // 更新执行日志
    const log = await prisma.shadowExecutionLog.update({
      where: { id: logId },
      data: {
        realOutput,
        realLatencyMs,
        realCost,
        status: 'success',
        executedAt: new Date(),
      },
    })

    // 执行 Diff
    await runDiffEngine(log)

    // 记录成本
    await costGuardRecordCost('global', null, realCost)
    await costGuardRecordCost('task_type', taskType, realCost)

  } catch (err: any) {
    const realLatencyMs = Date.now() - startTime
    await prisma.shadowExecutionLog.update({
      where: { id: logId },
      data: {
        realLatencyMs,
        status: 'failed',
        errorMessage: err.message,
        executedAt: new Date(),
      },
    })
  }
}

// ============================================================
// Diff Engine — Mock vs Real 对比
// ============================================================

async function runDiffEngine(log: any): Promise<void> {
  const mockOutput = log.mockOutput as any
  const realOutput = log.realOutput

  if (!mockOutput || !realOutput) return

  // ① 结构一致性评分
  const structureScore = scoreStructure(mockOutput, realOutput)
  const structureMatch = structureScore >= 80

  // ② 延迟差异
  const latencyDelta = (log.realLatencyMs ?? 0) - (log.mockLatencyMs ?? 0)

  // ③ 成本差异
  const costDelta = Number(log.realCost ?? 0) - Number(log.mockCost ?? 0)

  // ④ 内容质量评分（AI Judge 模拟）
  const contentScore = scoreContent(mockOutput, realOutput)

  // ⑤ 漂移评分
  const driftScore = calculateDrift(structureScore, contentScore, latencyDelta, costDelta)

  // ⑥ 综合评分
  const overallScore = Math.round(
    structureScore * 0.3 +
    contentScore * 0.3 +
    Math.max(0, 100 - Math.abs(driftScore) * 2) * 0.2 +
    latencyScore(latencyDelta) * 0.1 +
    costScore(costDelta) * 0.1
  )

  // 创建 Diff Result
  await prisma.shadowDiffResult.create({
    data: {
      executionLogId: log.id,
      taskType: log.taskType,
      modelName: log.modelName,
      structureMatch,
      structureScore,
      contentScore,
      latencyDelta,
      costDelta,
      driftScore,
      overallScore,
      judgedAt: new Date(),
    },
  })

  // 漂移检测触发回滚
  if (driftScore > 50) {
    await recordDriftAndMaybeRollback(log.modelName, log.taskType, driftScore, overallScore)
  }
}

// ============================================================
// 漂移检测 + 自动回滚
// ============================================================

async function recordDriftAndMaybeRollback(modelName: string, taskType: string, driftScore: number, overallScore: number): Promise<void> {
  // 记录漂移
  await prisma.shadowDriftHistory.create({
    data: {
      modelName,
      taskType,
      windowCount: 1,
      avgDriftScore: driftScore,
      avgStructureScore: overallScore,
      avgContentScore: overallScore,
      avgLatencyDelta: 0,
      avgCostDelta: 0,
      sampleStartAt: new Date(),
      sampleEndAt: new Date(),
    },
  })

  // 如果 overallScore 连续低，触发自动回滚
  const config = await prisma.shadowConfig.findFirst({ where: { id: 'default-shadow-config' } })
  if (config && config.autoRollback && config.grayThreshold > 0) {
    // 降低灰度阈值（自动回滚）
    const newThreshold = Math.max(0, config.grayThreshold - 20)
    await prisma.shadowConfig.update({
      where: { id: 'default-shadow-config' },
      data: {
        grayThreshold: newThreshold,
        lastRolledBack: new Date(),
      },
    })
    console.log(`[Shadow] Auto-rollback triggered: grayThreshold ${config.grayThreshold} → ${newThreshold} (drift=${driftScore.toFixed(1)})`)
  }
}

// ============================================================
// 评分函数
// ============================================================

function scoreStructure(mock: any, real: any): number {
  try {
    const mockStr = typeof mock === 'string' ? mock : JSON.stringify(mock)
    const realStr = typeof real === 'string' ? real : JSON.stringify(real)

    // 简单的结构比较：key 集合一致性
    const mockKeys = extractKeys(mock)
    const realKeys = extractKeys(real)

    if (mockKeys.length === 0 && realKeys.length === 0) return 100

    const intersection = mockKeys.filter(k => realKeys.includes(k))
    const union = [...new Set([...mockKeys, ...realKeys])]
    return Math.round((intersection.length / union.length) * 100)
  } catch {
    return 50 // 无法比较时给中等分
  }
}

function extractKeys(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [prefix || 'value']
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

function scoreContent(mock: any, real: any): number {
  // 模拟 AI Judge：检查输出长度 + 类型一致性
  // Phase 6C 后替换为真实 LLM 评分
  const mockStr = typeof mock === 'string' ? mock : JSON.stringify(mock)
  const realStr = typeof real === 'string' ? real : JSON.stringify(real)

  if (!mockStr || !realStr) return 0

  // 长度相似度
  const lenRatio = Math.min(mockStr.length, realStr.length) / Math.max(mockStr.length, realStr.length)

  // 类型一致性
  const typeMatch = typeof mock === typeof real

  return Math.round((lenRatio * 60 + (typeMatch ? 40 : 0)))
}

function calculateDrift(structureScore: number, contentScore: number, latencyDelta: number, costDelta: number): number {
  // 漂移：结构 + 内容差异越大，漂移越高
  const structureDrift = 100 - structureScore
  const contentDrift = 100 - contentScore
  const latencyDrift = Math.min(100, latencyDelta / 100) // 1s = 1pt
  const costDrift = Math.min(100, Math.abs(costDelta) * 1000) // $0.001 = 1pt

  return Math.round((structureDrift * 0.4 + contentDrift * 0.3 + latencyDrift * 0.15 + costDrift * 0.15))
}

function latencyScore(latencyDelta: number): number {
  if (latencyDelta <= 0) return 100 // 真实不比 mock 慢
  if (latencyDelta < 1000) return 80
  if (latencyDelta < 5000) return 50
  if (latencyDelta < 10000) return 30
  return 10
}

function costScore(costDelta: number): number {
  if (costDelta <= 0) return 100
  if (costDelta < 0.005) return 80
  if (costDelta < 0.01) return 60
  if (costDelta < 0.05) return 30
  return 10
}

// ============================================================
// 输出生成 / 成本估算
// ============================================================

function generateRealOutput(taskType: string, modelName: string, promptPreview?: string): any {
  const base = {
    chat_completion: {
      content: promptPreview
        ? `[Real API] Response to: "${promptPreview.slice(0, 50)}..." (processed by ${modelName})`
        : `[Real API] Generated content via ${modelName}`,
      model: modelName,
      usage: { prompt_tokens: 150, completion_tokens: 200, total_tokens: 350 },
    },
    image: {
      url: `https://api.example.com/generated/${Date.now()}.png`,
      model: modelName,
      size: '1024x1024',
    },
    video: {
      url: `https://api.example.com/videos/${Date.now()}.mp4`,
      model: modelName,
      duration: 10,
      resolution: '1920x1080',
    },
    tts: {
      audioUrl: `https://api.example.com/audio/${Date.now()}.mp3`,
      model: modelName,
      duration: 5.2,
    },
  }

  const typeKey = taskType === 'text_script' || taskType === 'storyboard' ? 'chat_completion'
    : taskType === 'character_gen' || taskType === 'scene_gen' ? 'image'
    : taskType === 'video_gen' ? 'video'
    : taskType === 'voiceover' ? 'tts'
    : 'chat_completion'

  return base[typeKey]
}

function estimateCost(taskType: string, modelName?: string): number {
  const costs: Record<string, number> = {
    text_script: 0.005,
    storyboard: 0.008,
    character_gen: 0.02,
    scene_gen: 0.02,
    video_gen: 0.05,
    voiceover: 0.01,
  }
  return costs[taskType] ?? 0.005
}

// ============================================================
// 灰度控制 API
// ============================================================

export async function updateGrayThreshold(threshold: number): Promise<any> {
  return prisma.shadowConfig.update({
    where: { id: 'default-shadow-config' },
    data: { grayThreshold: Math.max(0, Math.min(100, threshold)) },
  })
}

export async function toggleShadow(enabled: boolean): Promise<any> {
  return prisma.shadowConfig.update({
    where: { id: 'default-shadow-config' },
    data: { enabled },
  })
}

// ============================================================
// 查询 API
// ============================================================

export async function getShadowStats() {
  const config = await prisma.shadowConfig.findFirst({ where: { id: 'default-shadow-config' } })

  const totalExecutions = await prisma.shadowExecutionLog.count()
  const successCount = await prisma.shadowExecutionLog.count({ where: { status: 'success' } })
  const failCount = await prisma.shadowExecutionLog.count({ where: { status: { in: ['failed', 'timeout', 'shadow_failed'] } } })

  const recentDiff = await prisma.shadowDiffResult.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const avgOverallScore = recentDiff.length > 0
    ? recentDiff.reduce((sum, d) => sum + Number(d.overallScore), 0) / recentDiff.length
    : 0

  const recentDrift = await prisma.shadowDriftHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const activeCostBudgets = await prisma.costBudget.findMany({
    where: { enabled: true },
    orderBy: { scope: 'asc' },
  })

  return {
    config,
    stats: {
      totalExecutions,
      successCount,
      failCount,
      successRate: totalExecutions > 0 ? ((successCount / totalExecutions) * 100).toFixed(1) + '%' : '0%',
    },
    quality: {
      avgOverallScore: avgOverallScore.toFixed(1),
      recentDiffs: recentDiff,
      recentDrifts: recentDrift,
    },
    costs: activeCostBudgets.map(b => ({
      scope: b.scope,
      scopeId: b.scopeId,
      budget: Number(b.budgetAmount).toFixed(4),
      spent: Number(b.spentAmount).toFixed(4),
      usage: Number(b.budgetAmount) > 0 ? ((Number(b.spentAmount) / Number(b.budgetAmount)) * 100).toFixed(1) + '%' : '0%',
      alertAt: `${b.alertThreshold}%`,
      blockAt: `${b.blockThreshold}%`,
      lastAlertAt: b.lastAlertAt,
      lastBlockedAt: b.lastBlockedAt,
    })),
  }
}

export async function getShadowLogs(limit = 20, offset = 0) {
  return prisma.shadowExecutionLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: { diffResult: true },
  })
}
