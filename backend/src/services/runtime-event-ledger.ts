/**
 * runtime-event-ledger.ts
 *
 * Event Ledger — 系统运行时事件统一写入点。
 * 所有 provider 调用、fallback、超时、错误都通过此 service 记录。
 *
 * 这是 Runtime Observability Civilization 的第一步：
 *   不再是各模块各写各的日志表，
 *   而是所有事件统一 schema、统一写入、统一查询。
 *
 * Constitutional:
 *   - 所有 P0/P1 runtime 模块必须使用此 service 记录事件
 *   - 禁止直接写 InvocationLog / AiExecutionLog 等表
 *   - 未来 trace layer 依赖此数据
 */

import { prisma } from '../utils/index.js'

export interface LedgerEvent {
  userId: string
  projectId?: string | null
  traceId?: string | null
  executionId?: string | null
  stageId?: string | null
  capability: 'llm' | 'image' | 'video' | 'tts'
  provider: string
  model: string
  status: 'success' | 'failed' | 'timeout' | 'fallback'
  latencyMs?: number | null
  tokenUsage?: number | null
  errorMsg?: string | null
  fallbackChain?: FallbackStep[] | null
  sourcePath?: string | null
  agentType?: string | null
  operationType?: string | null
  assetRegistryId?: string | null
}

export interface FallbackStep {
  provider: string
  model: string
  status: string
  latencyMs: number
  errorMsg?: string | null
}

/**
 * 写入 runtime event ledger
 * 单次写入，不重试 — 失败不影响主流程
 */
export async function writeLedger(event: LedgerEvent): Promise<void> {
  try {
    await prisma.invocationLog.create({
      data: {
        userId: event.userId,
        projectId: event.projectId ?? null,
        traceId: event.traceId ?? null,
        executionId: event.executionId ?? null,
        stageId: event.stageId ?? null,
        capability: event.capability,
        provider: event.provider,
        model: event.model,
        status: event.status,
        latencyMs: event.latencyMs ?? null,
        tokenUsage: event.tokenUsage ?? null,
        errorMsg: event.errorMsg ?? null,
        fallbackChain: event.fallbackChain ? JSON.parse(JSON.stringify(event.fallbackChain)) : null,
        sourcePath: event.sourcePath ?? null,
        runtimeVersion: process.env.RUNTIME_VERSION || '20260531_baseline',
        agentType: event.agentType ?? null,
        operationType: event.operationType ?? null,
        assetRegistryId: event.assetRegistryId ?? null,
      },
    })
  } catch (err) {
    // ledger write 失败不应影响主流程
    console.warn('[RuntimeEventLedger] write failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

/**
 * 查询最近的 runtime events，按时间倒序
 */
export async function queryLedger(opts: {
  userId?: string
  projectId?: string
  traceId?: string
  executionId?: string
  capability?: string
  status?: string
  limit?: number
  offset?: number
} = {}) {
  const where: any = {}
  if (opts.userId) where.userId = opts.userId
  if (opts.projectId) where.projectId = opts.projectId
  if (opts.traceId) where.traceId = opts.traceId
  if (opts.executionId) where.executionId = opts.executionId
  if (opts.capability) where.capability = opts.capability
  if (opts.status) where.status = opts.status

  const [items, total] = await Promise.all([
    prisma.invocationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit || 50,
      skip: opts.offset || 0,
    }),
    prisma.invocationLog.count({ where }),
  ])

  return { items, total }
}

/**
 * 获取 event ledger 的统计快照
 */
export async function ledgerSummary(opts: {
  userId?: string
  since?: Date
} = {}) {
  const since = opts.since || new Date(Date.now() - 24 * 60 * 60 * 1000) // 默认过去24小时

  const where: any = { createdAt: { gte: since } }
  if (opts.userId) where.userId = opts.userId

  const all = await prisma.invocationLog.findMany({
    where,
    select: { status: true, capability: true, latencyMs: true, provider: true },
  })

  const summary = {
    total: all.length,
    byStatus: {} as Record<string, number>,
    byCapability: {} as Record<string, number>,
    byProvider: {} as Record<string, number>,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
  }

  const latencies: number[] = []

  for (const e of all) {
    summary.byStatus[e.status] = (summary.byStatus[e.status] || 0) + 1
    summary.byCapability[e.capability] = (summary.byCapability[e.capability] || 0) + 1
    summary.byProvider[e.provider] = (summary.byProvider[e.provider] || 0) + 1
    if (e.latencyMs != null) latencies.push(e.latencyMs)
  }

  if (latencies.length > 0) {
    latencies.sort((a, b) => a - b)
    summary.avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    const p95Idx = Math.ceil(latencies.length * 0.95) - 1
    summary.p95LatencyMs = latencies[Math.max(0, p95Idx)]
  }

  return summary
}
