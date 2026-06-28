/**
 * PromptRuntimeLogger.ts — Phase 4-A 最小运行时日志
 *
 * 作用：
 * 1. 每次 prompt 调用记录一条结构化日志
 * 2. 为 Phase 4-B 的 AB Testing 提供 baseline
 * 3. 不评分、不分析、不演化——只记录
 *
 * @phase-4a
 */

import { prisma } from '../../utils/index.js'
import { runAsAdmin } from './PromptAccessGuard.js'
import crypto from 'crypto'

// ─── 日志类型 ───

export interface PromptLogEntry {
  promptName: string
  version: string
  routingMode: string
  contextHash?: string
  latencyMs: number
  success: boolean
  responseChars: number
}

// ─── 核心函数 ───

/**
 * 计算 context 的 hash（用于后续重复模式识别）
 */
export function hashContext(context?: Record<string, any>): string | undefined {
  if (!context || Object.keys(context).length === 0) return undefined
  const stable = JSON.stringify(context, Object.keys(context).sort())
  return crypto.createHash('md5').update(stable).digest('hex').slice(0, 12)
}

/**
 * 记录一次 prompt 调用
 */
export async function logPromptCall(entry: PromptLogEntry): Promise<void> {
  try {
    await runAsAdmin(() =>
      prisma.promptRuntimeLog.create({
        data: {
          promptName: entry.promptName,
          version: entry.version,
          routingMode: entry.routingMode,
          contextHash: entry.contextHash,
          latencyMs: entry.latencyMs,
          success: entry.success,
          responseChars: entry.responseChars,
        },
      })
    )
  } catch (err) {
    // 日志写入失败不冒泡——不因日志影响业务
    console.warn('[PromptRuntimeLogger] ⚠️ 日志写入失败:', (err as Error).message)
  }
}

/**
 * 获取最近 N 条日志（用于观测）
 */
export async function getRecentLogs(limit = 100): Promise<PromptLogEntry[]> {
  const rows = await runAsAdmin(() =>
    prisma.promptRuntimeLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  )

  return rows.map(r => ({
    promptName: r.promptName,
    version: r.version,
    routingMode: r.routingMode,
    contextHash: r.contextHash || undefined,
    latencyMs: r.latencyMs,
    success: r.success,
    responseChars: r.responseChars,
  }))
}

/**
 * 获取某个 prompt 的日志统计
 */
export async function getPromptStats(name: string): Promise<{
  totalCalls: number
  avgLatency: number
  successRate: number
  versionDistribution: Record<string, number>
}> {
  const rows = await runAsAdmin(() =>
    prisma.promptRuntimeLog.findMany({
      where: { promptName: name },
    })
  )

  const total = rows.length
  if (total === 0) {
    return { totalCalls: 0, avgLatency: 0, successRate: 1, versionDistribution: {} }
  }

  const avgLatency = Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / total)
  const successCount = rows.filter(r => r.success).length
  const versionDist: Record<string, number> = {}
  for (const r of rows) {
    versionDist[r.version] = (versionDist[r.version] || 0) + 1
  }

  return {
    totalCalls: total,
    avgLatency,
    successRate: successCount / total,
    versionDistribution: versionDist,
  }
}
