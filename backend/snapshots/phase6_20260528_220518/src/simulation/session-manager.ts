/**
 * Stability Session 管理器
 *
 * 每次长稳测试 = 一个 Session
 * 保存系统指纹、退化事件、绑定 replay 帧
 */

import { prisma } from '../utils/index.js'

// ============================================================
// 实验阶段定义（30min 标准配置）
// ============================================================

export interface PhaseDef {
  name: string
  startSec: number
  endSec: number
  description: string
  /** 负载强度 multiplier */
  intensity: number
  /** 负载模式 */
  pattern: 'steady' | 'burst' | 'wave' | 'chaos'
}

export const DEFAULT_PHASES: PhaseDef[] = [
  { name: 'warmup',     startSec: 0,    endSec: 300,  description: '预热：轻负载',       intensity: 0.3, pattern: 'steady' },
  { name: 'stable',     startSec: 300,  endSec: 600,  description: '稳定负载',            intensity: 0.5, pattern: 'steady' },
  { name: 'burst',      startSec: 600,  endSec: 900,  description: '爆发：高负载冲击',    intensity: 1.0, pattern: 'burst' },
  { name: 'chaos',      startSec: 900,  endSec: 1200, description: '混沌：注入故障',      intensity: 0.7, pattern: 'chaos' },
  { name: 'recovery',   startSec: 1200, endSec: 1500, description: '恢复：系统自愈',      intensity: 0.4, pattern: 'steady' },
  { name: 'cooldown',   startSec: 1500, endSec: 1800, description: '冷却：低负载验证',    intensity: 0.2, pattern: 'steady' },
]

// ============================================================
// Session CRUD
// ============================================================

/**
 * 创建一个新的稳定性实验 Session
 */
export async function createSession(label?: string): Promise<{ id: number }> {
  const session: any[] = await prisma.$queryRawUnsafe(
    `INSERT INTO stability_sessions (label, status, "startedAt", phases)
     VALUES ($1, 'running', NOW(), $2::jsonb)
     RETURNING id`,
    label ?? null,
    JSON.stringify(DEFAULT_PHASES)
  )
  return { id: Number(session[0].id) }
}

/**
 * 完成一个 Session（记录结束时间、计算评分和指纹）
 */
export async function completeSession(
  sessionId: number,
  score?: number,
  grade?: string,
): Promise<void> {
  // 收集该 Session 期间的退化事件
  const events: any[] = await prisma.$queryRawUnsafe(
    `SELECT "eventType", severity FROM degradation_events
     WHERE "sessionId" = $1
     ORDER BY "elapsedSec" ASC`,
    sessionId
  )
  const eventCount = events.length
  const worstEvent = events.find((e: any) => e.severity === 'emergency')?.eventType
    ?? events.find((e: any) => e.severity === 'critical')?.eventType

  // 计算指纹
  const fingerprint = await computeSessionFingerprint(sessionId)

  await prisma.$executeRawUnsafe(
    `UPDATE stability_sessions
     SET
       status = 'completed',
       "finishedAt" = NOW(),
       "durationSec" = EXTRACT(EPOCH FROM (NOW() - "startedAt")),
       grade = $1,
       score = $2,
       "eventCount" = $3,
       "worstEvent" = $4,
       "queuePattern" = $5,
       "workerDecayCurve" = $6,
       "pidSignature" = $7,
       "costProfile" = $8,
       "recoveryProfile" = $9
     WHERE id = $10`,
    grade ?? null,
    score ?? null,
    eventCount,
    worstEvent ?? null,
    fingerprint.queuePattern,
    fingerprint.workerDecay,
    fingerprint.pidSignature,
    fingerprint.costProfile,
    fingerprint.recoveryProfile,
    sessionId
  )
}

/**
 * 取消一个 Session
 */
export async function cancelSession(sessionId: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE stability_sessions SET status = 'cancelled', "finishedAt" = NOW() WHERE id = $1`,
    sessionId
  )
}

// ============================================================
// Fingerprint 计算
// ============================================================

async function computeSessionFingerprint(sessionId: number): Promise<{
  queuePattern: string
  workerDecay: string
  pidSignature: string
  costProfile: string
  recoveryProfile: string
}> {
  const session: any[] = await prisma.$queryRawUnsafe(
    `SELECT "startedAt", "finishedAt" FROM stability_sessions WHERE id = $1`,
    sessionId
  )
  if (session.length === 0 || !session[0].startedAt) {
    return { queuePattern: 'unknown', workerDecay: 'unknown', pidSignature: 'unknown', costProfile: 'unknown', recoveryProfile: 'unknown' }
  }

  const start = session[0].startedAt
  const end = session[0].finishedAt ?? new Date()

  const metrics: any[] = await prisma.$queryRawUnsafe(
    `SELECT queue_length, queue_pressure, pid_pressure, memory_mb, ses
     FROM system_metrics
     WHERE timestamp BETWEEN $1 AND $2
     ORDER BY timestamp ASC`,
    start, end
  )

  if (metrics.length < 10) {
    return { queuePattern: 'insufficient', workerDecay: 'insufficient', pidSignature: 'insufficient', costProfile: 'insufficient', recoveryProfile: 'insufficient' }
  }

  // 队列模式: 看 queue_pressure 的变异系数
  const qPressures = metrics.map((m: any) => Number(m.queue_pressure))
  const qMean = qPressures.reduce((a: number, b: number) => a + b, 0) / qPressures.length
  const qVar = Math.sqrt(qPressures.reduce((a: number, b: number) => a + (b - qMean) ** 2, 0) / qPressures.length)
  const qCV = qMean > 0 ? qVar / qMean : 0
  const queuePattern = qCV < 0.2 ? 'stable' : qCV < 0.5 ? 'oscillating' : 'diverging'

  // PID 签名
  const pids = metrics.map((m: any) => Number(m.pid_pressure))
  const pMean = pids.reduce((a: number, b: number) => a + b, 0) / pids.length
  const pVar = Math.sqrt(pids.reduce((a: number, b: number) => a + (b - pMean) ** 2, 0) / pids.length)
  const pCV = pMean > 0 ? pVar / pMean : 0
  const pidSignature = pCV < 0.15 ? 'tight' : pCV < 0.4 ? 'spiky' : 'oscillating'

  // Worker 衰减
  const half = Math.floor(pids.length / 2)
  const firstHalf = pids.slice(0, half).reduce((a: number, b: number) => a + b, 0) / half
  const secondHalf = pids.slice(half).reduce((a: number, b: number) => a + b, 0) / (pids.length - half)
  const decay = firstHalf > 0 ? (secondHalf - firstHalf) / firstHalf : 0
  const workerDecay = Math.abs(decay) < 0.05 ? 'flat' : decay < -0.1 ? 'slow_decay' : decay < -0.25 ? 'sharp_decay' : 'flat'

  return { queuePattern, workerDecay, pidSignature, costProfile: 'linear', recoveryProfile: 'quick' }
}

// ============================================================
// 退化事件
// ============================================================

/**
 * 记录一个退化事件
 */
export async function recordDegradationEvent(
  sessionId: number,
  eventType: string,
  severity: 'warning' | 'critical' | 'emergency',
  message: string,
  metricSnapshot?: Record<string, any>,
): Promise<void> {
  const elapsed: any[] = await prisma.$queryRawUnsafe(
    `SELECT EXTRACT(EPOCH FROM (NOW() - "startedAt"))::int AS elapsed
     FROM stability_sessions WHERE id = $1`,
    sessionId
  )

  const elapsedSec = elapsed.length > 0 ? Number(elapsed[0].elapsed) : 0

  await prisma.$executeRawUnsafe(
    `INSERT INTO degradation_events ("sessionId", timestamp, "elapsedSec", "eventType", severity, message, "metricValues")
     VALUES ($1, NOW(), $2, $3, $4, $5, $6::jsonb)`,
    sessionId,
    elapsedSec,
    eventType,
    severity,
    message,
    metricSnapshot ? JSON.stringify(metricSnapshot) : null,
  )
}

// ============================================================
// 获取当前阶段（根据 elapsed seconds）
// ============================================================

export function getCurrentPhase(elapsedSec: number, phases: PhaseDef[] = DEFAULT_PHASES): { phase: PhaseDef; progress: number } {
  for (const phase of phases) {
    if (elapsedSec >= phase.startSec && elapsedSec < phase.endSec) {
      const progress = (elapsedSec - phase.startSec) / (phase.endSec - phase.startSec)
      return { phase, progress }
    }
  }
  const last = phases[phases.length - 1]
  return { phase: last, progress: elapsedSec >= last.endSec ? 1 : 0 }
}
