/**
 * Stability Session API — 创建/查询实验记录
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { createSession, completeSession, cancelSession } from './session-manager.js'

export async function registerSessionRoutes(app: FastifyInstance) {
  // 创建新 session
  app.post('/api/stability/sessions', async (request) => {
    const body = request.body as any
    const session = await createSession(body?.label)
    return session
  })

  // 查询 session 列表
  app.get('/api/stability/sessions', async (request) => {
    const query = request.query as any
    const limit = Math.min(parseInt(query.limit || '20'), 100)

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        label,
        status,
        "startedAt" AS "startedAt",
        "finishedAt" AS "finishedAt",
        "durationSec" AS "durationSec",
        grade,
        score,
        "eventCount" AS "eventCount",
        "worstEvent" AS "worstEvent",
        "queuePattern" AS "queuePattern",
        "workerDecayCurve" AS "workerDecayCurve",
        "pidSignature" AS "pidSignature",
        "costProfile" AS "costProfile",
        "recoveryProfile" AS "recoveryProfile"
      FROM stability_sessions
      ORDER BY "startedAt" DESC
      LIMIT $1
    `, limit)

    return {
      sessions: rows.map((r: any) => ({
        id: Number(r.id),
        label: r.label,
        status: r.status,
        startedAt: r.startedAt?.toISOString?.() ?? r.startedAt,
        finishedAt: r.finishedAt?.toISOString?.() ?? r.finishedAt,
        durationSec: Number(r.durationSec ?? 0),
        grade: r.grade,
        score: r.score != null ? Number(r.score) : null,
        eventCount: Number(r.eventCount ?? 0),
        worstEvent: r.worstEvent,
        queuePattern: r.queuePattern,
        workerDecayCurve: r.workerDecayCurve,
        pidSignature: r.pidSignature,
        costProfile: r.costProfile,
        recoveryProfile: r.recoveryProfile,
      })),
    }
  })

  // 查询单个 session（含退化事件）
  app.get('/api/stability/sessions/:id', async (request) => {
    const params = request.params as any
    const id = parseInt(params.id)

    const sessions: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id, label, status, "startedAt", "finishedAt", "durationSec", grade, score,
        "eventCount", "worstEvent", "queuePattern", "workerDecayCurve",
        "pidSignature", "costProfile", "recoveryProfile", phases
      FROM stability_sessions WHERE id = $1
    `, id)

    if (sessions.length === 0) {
      return { error: 'Session not found' }
    }

    const s = sessions[0]

    // 退化事件
    const events: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, timestamp, "elapsedSec" AS "elapsedSec", "eventType" AS "eventType",
             severity, message, "metricValues" AS "metricValues"
      FROM degradation_events
      WHERE "sessionId" = $1
      ORDER BY "elapsedSec" ASC
    `, id)

    // 绑定帧的数量
    const frameCount: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS count FROM replay_frames WHERE "sessionId" = $1
    `, id)

    return {
      session: {
        id: Number(s.id),
        label: s.label,
        status: s.status,
        startedAt: s.startedAt?.toISOString?.() ?? s.startedAt,
        finishedAt: s.finishedAt?.toISOString?.() ?? s.finishedAt,
        durationSec: Number(s.durationSec ?? 0),
        grade: s.grade,
        score: s.score != null ? Number(s.score) : null,
        eventCount: Number(s.eventCount ?? 0),
        worstEvent: s.worstEvent,
        queuePattern: s.queuePattern,
        workerDecayCurve: s.workerDecayCurve,
        pidSignature: s.pidSignature,
        costProfile: s.costProfile,
        recoveryProfile: s.recoveryProfile,
        phases: s.phases,
      },
      events: events.map((e: any) => ({
        id: Number(e.id),
        timestamp: e.timestamp,
        elapsedSec: Number(e.elapsedSec),
        eventType: e.eventType,
        severity: e.severity,
        message: e.message,
        metricValues: e.metricValues,
      })),
      frameCount: Number(frameCount[0]?.count ?? 0),
    }
  })

  // 取消 session
  app.post('/api/stability/sessions/:id/cancel', async (request) => {
    const params = request.params as any
    await cancelSession(parseInt(params.id))
    return { ok: true }
  })

  // 绑定 replay 帧到 session
  app.get('/api/replay/frames/session/:sessionId', async (request) => {
    const params = request.params as any
    const sessionId = parseInt(params.sessionId)

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        EXTRACT(EPOCH FROM timestamp) * 1000 AS "timestamp",
        queue_length AS "queueLength", queue_pressure AS "queuePressure",
        active_workers AS "activeWorkers", worker_throughput AS "workerThroughput",
        pid_pressure AS "pidPressure", generator_rate AS "generatorRate",
        ses, memory_mb AS "memoryMb", label
      FROM replay_frames
      WHERE "sessionId" = $1
      ORDER BY timestamp ASC
    `, sessionId)

    return {
      frames: rows.map((r: any) => ({
        ...r,
        id: Number(r.id),
        timestamp: Number(r.timestamp),
        queueLength: Number(r.queueLength ?? 0),
        queuePressure: Number(r.queuePressure ?? 0),
      })),
      count: rows.length,
    }
  })
}
