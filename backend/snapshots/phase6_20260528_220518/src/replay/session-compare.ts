/**
 * Session Compare Engine — 跨实验行为对比
 *
 * 核心能力：
 *   ① 两次 Session 的系统行为定量比较
 *   ② Fingerprint 形态对比（队列模式/PID签名等）
 *   ③ 自动回归检测
 *   ④ 行为相似度匹配
 */

import { prisma } from '../utils/index.js'

// ============================================================
// 类型定义
// ============================================================

export interface CompareResult {
  baseSessionId: number
  targetSessionId: number
  baseLabel: string
  targetLabel: string

  // 定量比较
  metrics: CompareMetric[]
  summary: {
    improved: number     // 改善的指标数
    regressed: number    // 退化的指标数
    unchanged: number    // 不变的指标数
  }

  // 回归检测
  regressions: Regression[]

  // 指纹对比
  fingerprintDiff: {
    queuePattern: { base: string; target: string; delta: string }
    workerDecay: { base: string; target: string; delta: string }
    pidSignature: { base: string; target: string; delta: string }
    costProfile: { base: string; target: string; delta: string }
    recoveryProfile: { base: string; target: string; delta: string }
  }

  // 行为相似度（vs 过去故障模式）
  behaviorMatch?: {
    matchedSessionId: number
    similarity: number
    pattern: string
  }
}

export interface CompareMetric {
  name: string
  label: string
  base: number
  target: number
  delta: number      // 绝对值变化
  percent: string    // 百分比变化
  direction: 'improved' | 'regressed' | 'unchanged'
  threshold: number  // 回归阈值（超过即报警）
}

export interface Regression {
  metric: string
  label: string
  severity: 'minor' | 'moderate' | 'critical'
  base: number
  target: number
  percent: string
}

// 行为相似度匹配的故障模式库
interface FailureProfile {
  sessionId: number
  pattern: string
  features: Record<string, number>
}

// ============================================================
// 核心比较函数
// ============================================================

/**
 * 比较两次 Stability Session
 */
export async function compareSessions(
  baseSessionId: number,
  targetSessionId: number
): Promise<CompareResult> {
  // 获取两个 session 的完整数据
  const [baseSession, targetSession] = await Promise.all([
    getSessionFull(baseSessionId),
    getSessionFull(targetSessionId),
  ])

  if (!baseSession || !targetSession) {
    throw new Error(`Session(s) not found: ${!baseSession ? baseSessionId : targetSessionId}`)
  }

  // 获取 metrics 聚合
  const [baseMetrics, targetMetrics] = await Promise.all([
    getMetricsAggregation(baseSession),
    getMetricsAggregation(targetSession),
  ])

  // 1. 定量比较
  const metrics = computeMetrics(baseMetrics, targetMetrics)

  // 2. 回归检测
  const regressions = detectRegressions(metrics)

  // 3. 指纹对比
  const fingerprintDiff = compareFingerprints(
    baseSession, targetSession
  )

  // 4. 行为匹配（与历史故障模式）
  const behaviorMatch = await matchFailurePattern(targetMetrics)

  // 5. 汇总
  const improved = metrics.filter(m => m.direction === 'improved').length
  const regressed = metrics.filter(m => m.direction === 'regressed').length
  const unchanged = metrics.filter(m => m.direction === 'unchanged').length

  return {
    baseSessionId,
    targetSessionId,
    baseLabel: baseSession.label ?? `Session #${baseSessionId}`,
    targetLabel: targetSession.label ?? `Session #${targetSessionId}`,
    metrics,
    summary: { improved, regressed, unchanged },
    regressions,
    fingerprintDiff,
    behaviorMatch,
  }
}

// ============================================================
// Session 数据获取
// ============================================================

interface SessionData {
  id: number
  label: string | null
  startedAt: Date
  finishedAt: Date | null
  durationSec: number
  score: number | null
  grade: string | null
  queuePattern: string | null
  workerDecayCurve: string | null
  pidSignature: string | null
  costProfile: string | null
  recoveryProfile: string | null
  events: any[]
}

async function getSessionFull(sessionId: number): Promise<SessionData | null> {
  const sessions: any[] = await prisma.$queryRawUnsafe(
    `SELECT
      id, label, status, "startedAt", "finishedAt", "durationSec",
      grade, score, "queuePattern", "workerDecayCurve",
      "pidSignature", "costProfile", "recoveryProfile"
    FROM stability_sessions WHERE id = $1`,
    sessionId
  )

  if (sessions.length === 0) return null
  const s = sessions[0]

  // 退化事件
  const events: any[] = await prisma.$queryRawUnsafe(
    `SELECT "elapsedSec", "eventType", severity, message
     FROM degradation_events WHERE "sessionId" = $1
     ORDER BY "elapsedSec" ASC`,
    sessionId
  )

  return {
    id: Number(s.id),
    label: s.label,
    startedAt: s.startedAt as Date,
    finishedAt: s.finishedAt as Date | null,
    durationSec: Number(s.durationSec ?? 0),
    score: s.score != null ? Number(s.score) : null,
    grade: s.grade,
    queuePattern: s.queuePattern as string | null,
    workerDecayCurve: s.workerDecayCurve as string | null,
    pidSignature: s.pidSignature as string | null,
    costProfile: s.costProfile as string | null,
    recoveryProfile: s.recoveryProfile as string | null,
    events,
  }
}

// ============================================================
// Metrics 聚合（从 system_metrics 计算均值/方差/趋势）
// ============================================================

interface MetricsAggregation {
  avgQueueLength: number
  avgQueuePressure: number
  avgMemoryMb: number
  avgSes: number
  avgPidRate: number
  queueVariance: number
  pidVariance: number
  memoryTrend: number
  eventCount: number
  durationSec: number
}

async function getMetricsAggregation(session: SessionData): Promise<MetricsAggregation> {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT
      COALESCE(AVG("queueLength"), 0) AS avg_q,
      COALESCE(STDDEV("queueLength"), 0) AS std_q,
      COALESCE(AVG("queuePressure"), 0) AS avg_qp,
      COALESCE(STDDEV("queuePressure"), 0) AS std_qp,
      COALESCE(AVG("memoryMb"), 0) AS avg_mem,
      COALESCE(AVG(ses), 1) AS avg_ses,
      COALESCE(AVG("pidPressure"), 0) AS avg_pid,
      COALESCE(STDDEV("pidPressure"), 0) AS std_pid,
      COUNT(*) AS count
    FROM system_metrics
    WHERE timestamp BETWEEN $1 AND $2`,
    session.startedAt,
    session.finishedAt ?? new Date()
  )

  const r = rows[0] ?? {}
  return {
    avgQueueLength: Number(r.avg_q ?? 0),
    avgQueuePressure: Number(r.avg_qp ?? 0),
    avgMemoryMb: Number(r.avg_mem ?? 0),
    avgSes: Number(r.avg_ses ?? 1),
    avgPidRate: Number(r.avg_pid ?? 0),
    queueVariance: Number(r.std_q ?? 0),
    pidVariance: Number(r.std_pid ?? 0),
    memoryTrend: 0,
    eventCount: session.events.length,
    durationSec: session.durationSec,
  }
}

// ============================================================
// 指标对比
// ============================================================

const METRIC_DEFS: { name: string; label: string; threshold: number; improvedLower: boolean }[] = [
  { name: 'queueLength',     label: '队列深度',       threshold: 0.2,  improvedLower: true },
  { name: 'queuePressure',   label: '队列压力',       threshold: 0.15, improvedLower: true },
  { name: 'queueVariance',   label: '队列波动',       threshold: 0.25, improvedLower: true },
  { name: 'pidVariance',     label: 'PID 振荡',       threshold: 0.25, improvedLower: true },
  { name: 'avgSes',          label: 'SES',             threshold: 0.1,  improvedLower: false },
  { name: 'memoryTrend',     label: '内存斜率',       threshold: 0.2,  improvedLower: true },
  { name: 'avgMemoryMb',     label: '平均内存',       threshold: 0.15, improvedLower: true },
  { name: 'eventCount',      label: '退化事件数',     threshold: 0.15, improvedLower: true },
]

function computeMetrics(base: MetricsAggregation, target: MetricsAggregation): CompareMetric[] {
  return METRIC_DEFS.map(def => {
    const baseVal = (base as any)[def.name] ?? 0
    const targetVal = (target as any)[def.name] ?? 0
    const delta = targetVal - baseVal
    const percent = baseVal !== 0
      ? ((delta / baseVal) * 100).toFixed(1)
      : (targetVal > 0 ? '+∞' : '0')

    // 方向判断
    const absPct = Math.abs(parseFloat(percent) || 0)
    let direction: 'improved' | 'regressed' | 'unchanged'
    if (absPct <= def.threshold * 100) {
      direction = 'unchanged'
    } else if (def.improvedLower) {
      direction = delta < 0 ? 'improved' : 'regressed'
    } else {
      direction = delta > 0 ? 'improved' : 'regressed'
    }

    return {
      name: def.name,
      label: def.label,
      base: baseVal,
      target: targetVal,
      delta,
      percent: `${percent}%`,
      direction,
      threshold: def.threshold,
    }
  })
}

// ============================================================
// 回归检测
// ============================================================

function detectRegressions(metrics: CompareMetric[]): Regression[] {
  return metrics
    .filter(m => m.direction === 'regressed')
    .map(m => {
      const absPct = Math.abs(parseFloat(m.percent) || 0)
      const severity: 'minor' | 'moderate' | 'critical' =
        absPct > 50 ? 'critical' :
        absPct > 25 ? 'moderate' :
        'minor'

      return {
        metric: m.name,
        label: m.label,
        severity,
        base: m.base,
        target: m.target,
        percent: m.percent,
      }
    })
}

// ============================================================
// Fingerprint 对比
// ============================================================

const FINGERPRINT_ORDER: Record<string, string[]> = {
  queuePattern: ['stable', 'oscillating', 'diverging'],
  workerDecayCurve: ['flat', 'slow_decay', 'sharp_decay'],
  pidSignature: ['tight', 'spiky', 'oscillating'],
  costProfile: ['linear', 'jumpy', 'runaway'],
  recoveryProfile: ['quick', 'slow', 'incomplete'],
}

function compareFingerprints(base: SessionData, target: SessionData) {
  const fields = ['queuePattern', 'workerDecay', 'pidSignature', 'costProfile', 'recoveryProfile'] as const
  const result: any = {}

  for (const field of fields) {
    const dbField = field === 'workerDecay' ? 'workerDecayCurve' : field
    const baseVal = (base as any)[dbField] ?? 'unknown'
    const targetVal = (target as any)[dbField] ?? 'unknown'

    const order = FINGERPRINT_ORDER[dbField] ?? []
    const baseIdx = order.indexOf(baseVal)
    const targetIdx = order.indexOf(targetVal)
    let delta = 'same'
    if (baseIdx >= 0 && targetIdx >= 0) {
      delta = targetIdx < baseIdx ? 'improved' : targetIdx > baseIdx ? 'regressed' : 'same'
    }

    result[field] = { base: baseVal, target: targetVal, delta }
  }

  return result
}

// ============================================================
// 故障模式匹配
// ============================================================

async function matchFailurePattern(
  metrics: MetricsAggregation
): Promise<{ matchedSessionId: number; similarity: number; pattern: string } | undefined> {
  // 获取所有非 running 的 session，筛选出 score < 70 的故障模式
  const failedSessions: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, score, grade, "queuePattern", "pidSignature", "workerDecayCurve"
     FROM stability_sessions
     WHERE status = 'completed' AND score IS NOT NULL
     ORDER BY score ASC
     LIMIT 10`
  )

  if (failedSessions.length === 0) return undefined

  let bestMatch: { matchedSessionId: number; similarity: number; pattern: string } | null = null

  for (const fs of failedSessions) {
    // 简单相似度：加权各项指标匹配
    const theirMetrics = await getMetricsAggregation({
      id: Number(fs.id),
      label: null,
      startedAt: new Date(0),
      finishedAt: null,
      durationSec: 0,
      score: null,
      grade: null,
      queuePattern: null,
      workerDecayCurve: null,
      pidSignature: null,
      costProfile: null,
      recoveryProfile: null,
      events: [],
    })

    // 使用 PID 振荡和队列压力的相似度
    const pidDiff = Math.abs(metrics.pidVariance - theirMetrics.pidVariance)
    const queueDiff = Math.abs(metrics.avgQueuePressure - theirMetrics.avgQueuePressure)
    const memDiff = Math.abs(metrics.avgMemoryMb - theirMetrics.avgMemoryMb)

    // 归一化相似度 [0, 1]
    const maxPid = Math.max(metrics.pidVariance, theirMetrics.pidVariance, 1)
    const maxQueue = Math.max(metrics.avgQueuePressure, theirMetrics.avgQueuePressure, 1)
    const maxMem = Math.max(metrics.avgMemoryMb, theirMetrics.avgMemoryMb, 1)

    const similarity = 1 - (
      0.4 * (pidDiff / maxPid) +
      0.3 * (queueDiff / maxQueue) +
      0.3 * (memDiff / maxMem)
    )

    if (similarity > 0.65 && !bestMatch || similarity > (bestMatch?.similarity ?? 0)) {
      bestMatch = {
        matchedSessionId: Number(fs.id),
        similarity: Math.round(similarity * 100),
        pattern: `Session #${fs.id} ${fs.grade} score=${fs.score ?? '?'}`,
      }
    }
  }

  return bestMatch ?? undefined
}
