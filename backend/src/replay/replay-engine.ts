/**
 * Replay Engine — 系统时间轴回放引擎
 *
 * 核心能力：
 *   ① 按时间点重建系统状态帧
 *   ② A/B 时间点差异分析（Diff Mode）
 *   ③ 关键帧自动标注（throttle/alert/emergency）
 *
 * 数据来源：
 *   - system_metrics（时序指标）
 *   - replay_frames（关键帧快照）
 *   - simulation_logs（事件日志）
 */

import { prisma } from '../utils/index.js'
import { BackpressureState } from '../utils/redis-state.js'

// ============================================================
// 类型定义
// ============================================================

export interface ReplayFrame {
  id?: number
  timestamp: number
  queueLength: number
  queuePressure: number
  activeWorkers?: number
  workerThroughput: number
  workerEfficiency?: number
  memoryMb: number
  pidPressure?: number
  generatorRate?: number
  ses: number
  costPerMin?: number
  totalCost?: number
  queueGrowthRate?: number
  workerTrend?: number
  memorySlope?: number
  pidVariance?: number
  stabilityScore?: number
  stabilityGrade?: string
  label?: string
}

export interface ReplayTimeline {
  frames: ReplayFrame[]
  totalFrames: number
  timeRange: { start: number; end: number }
}

export interface ReplayDiff {
  timeA: number
  timeB: number
  delta: Record<string, { from: number; to: number; change: number; percent: string }>
  significantChanges: string[]
}

// ============================================================
// 帧写入
// ============================================================

/**
 * 保存一个回放帧到关键帧表
 * 每 10s 由 collector 调用
 */
export async function saveReplayFrame(frame: ReplayFrame): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO replay_frames (
      timestamp, "queueLength", "queuePressure", "activeWorkers",
      "workerThroughput", "workerEfficiency", "pidPressure", "generatorRate",
      ses, "memoryMb", "costPerMin", "totalCost",
      "queueGrowthRate", "workerTrend", "memorySlope", "pidVariance",
      "stabilityScore", "stabilityGrade", label
    ) VALUES (
      to_timestamp($1 / 1000.0), $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
  `,
    frame.timestamp,
    frame.queueLength,
    frame.queuePressure,
    Math.round(frame.workerThroughput + 1),
    frame.workerThroughput,
    frame.workerEfficiency,
    frame.pidPressure,
    frame.generatorRate,
    frame.ses,
    frame.memoryMb,
    frame.costPerMin ?? 0,
    frame.totalCost ?? 0,
    frame.queueGrowthRate ?? null,
    frame.workerTrend ?? null,
    frame.memorySlope ?? null,
    frame.pidVariance ?? null,
    frame.stabilityScore ?? null,
    frame.stabilityGrade ?? null,
    frame.label ?? null,
  )
}

// ============================================================
// 帧查询
// ============================================================

/**
 * 按时间范围查询回放帧
 * 返回按时间排序的帧列表（最多 500 帧）
 */
export async function queryReplayFrames(
  startTime: number,
  endTime: number,
  limit = 500
): Promise<ReplayFrame[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      id,
      EXTRACT(EPOCH FROM timestamp) * 1000 AS "timestamp",
      "queueLength", "queuePressure", "activeWorkers",
      "workerThroughput", "workerEfficiency",
      "pidPressure", "generatorRate", ses,
      "memoryMb", "costPerMin", "totalCost",
      "queueGrowthRate", "workerTrend", "memorySlope", "pidVariance",
      "stabilityScore", "stabilityGrade", label
    FROM replay_frames
    WHERE timestamp BETWEEN to_timestamp($1 / 1000.0) AND to_timestamp($2 / 1000.0)
    ORDER BY timestamp ASC
    LIMIT $3
  `, startTime, endTime, limit)

  return rows.map((r: any) => normalizeRow(r))
}

/**
 * 查询最近的 N 个回放帧
 */
export async function queryRecentReplayFrames(limit = 100): Promise<ReplayFrame[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      id,
      EXTRACT(EPOCH FROM timestamp) * 1000 AS "timestamp",
      "queueLength", "queuePressure", "activeWorkers",
      "workerThroughput", "workerEfficiency",
      "pidPressure", "generatorRate", ses,
      "memoryMb", "costPerMin", "totalCost",
      "queueGrowthRate", "workerTrend", "memorySlope", "pidVariance",
      "stabilityScore", "stabilityGrade", label
    FROM replay_frames
    ORDER BY timestamp DESC
    LIMIT $1
  `, limit)

  return rows.reverse().map((r: any) => normalizeRow(r))
}

// ============================================================
// 单帧重建（根据时间点查询离它最近的帧）
// ============================================================

export async function getReplayFrameAtTime(targetTime: number): Promise<ReplayFrame | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      id,
      EXTRACT(EPOCH FROM timestamp) * 1000 AS "timestamp",
      "queueLength", "queuePressure", "activeWorkers",
      "workerThroughput", "workerEfficiency",
      "pidPressure", "generatorRate", ses,
      "memoryMb", "costPerMin", "totalCost",
      "queueGrowthRate", "workerTrend", "memorySlope", "pidVariance",
      "stabilityScore", "stabilityGrade", label
    FROM replay_frames
    WHERE timestamp <= to_timestamp($1 / 1000.0)
    ORDER BY timestamp DESC
    LIMIT 1
  `, targetTime)

  return rows.length > 0 ? normalizeRow(rows[0]) : null
}

// ============================================================
// Diff 模式 — 两个时间点的差异分析
// ============================================================

export async function computeReplayDiff(
  timeA: number,
  timeB: number
): Promise<ReplayDiff> {
  const frameA = await getReplayFrameAtTime(timeA)
  const frameB = await getReplayFrameAtTime(timeB)

  if (!frameA || !frameB) {
    throw new Error(`Cannot compute diff: frames not found at ${timeA} or ${timeB}`)
  }

  const fields: (keyof ReplayFrame)[] = [
    'queueLength', 'queuePressure', 'workerThroughput', 'ses',
    'memoryMb', 'generatorRate',
  ]

  const delta: Record<string, { from: number; to: number; change: number; percent: string }> = {}
  const significantChanges: string[] = []

  for (const field of fields) {
    const a = Number(frameA[field] ?? 0)
    const b = Number(frameB[field] ?? 0)
    const change = b - a
    const percent = a !== 0
      ? ((change / a) * 100).toFixed(1)
      : (b > 0 ? '∞' : '0')

    delta[field] = { from: a, to: b, change, percent: `${percent}%` }

    if (a !== 0 && Math.abs(change / a) > 0.15) {
      significantChanges.push(`${field}: ${a} → ${b} (${percent}%)`)
    }
  }

  return {
    timeA,
    timeB,
    delta,
    significantChanges,
  }
}

// ============================================================
// 行归一化（解决 BigInt 序列化问题）
// ============================================================

function normalizeRow(r: any): ReplayFrame {
  return {
    id: r.id != null ? Number(r.id) : undefined,
    timestamp: Number(r.timestamp),
    queueLength: Number(r.queueLength ?? 0),
    queuePressure: Number(r.queuePressure ?? 0),
    activeWorkers: Number(r.activeWorkers ?? 0),
    workerThroughput: Number(r.workerThroughput ?? 0),
    workerEfficiency: Number(r.workerEfficiency ?? 0),
    pidPressure: Number(r.pidPressure ?? 0),
    generatorRate: Number(r.generatorRate ?? 0),
    ses: Number(r.ses ?? 1),
    memoryMb: Number(r.memoryMb ?? 0),
    costPerMin: Number(r.costPerMin ?? 0),
    totalCost: Number(r.totalCost ?? 0),
    queueGrowthRate: r.queueGrowthRate != null ? Number(r.queueGrowthRate) : undefined,
    workerTrend: r.workerTrend != null ? Number(r.workerTrend) : undefined,
    memorySlope: r.memorySlope != null ? Number(r.memorySlope) : undefined,
    pidVariance: r.pidVariance != null ? Number(r.pidVariance) : undefined,
    stabilityScore: r.stabilityScore != null ? Number(r.stabilityScore) : undefined,
    stabilityGrade: r.stabilityGrade ?? undefined,
    label: r.label ?? undefined,
  }
}

// ============================================================
// 关键帧自动标注
// ============================================================

export function classifyFrameLabel(frame: Partial<ReplayFrame>): string {
  if (frame.ses != null && frame.ses < 0.2) return 'emergency'
  if (frame.queuePressure != null && frame.queuePressure > 0.7) return 'alert'
  if (frame.queuePressure != null && frame.queuePressure > 0.4) return 'warning'
  if (frame.workerTrend != null && frame.workerTrend < -0.1) return 'fatigue'
  if (frame.stabilityScore != null && frame.stabilityScore >= 85) return 'stable'
  return 'normal'
}
