// ════════════════════════════════════════════════════════════
// GEO Optimization v2 Routes
// GET  /api/geo/optimization/queue?projectId=  — 生成任务 + 合并持久化状态
// GET  /api/geo/optimization/tags?projectId=    — 分类标签
// POST /api/geo/optimization/batch/:action     — 批量更新状态 → DB
// PATCH /api/geo/optimization/task/:id/status  — 单任务更新状态 → DB
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { generateTasks } from '../recommendation/optimization-task.service.js'
import { optimizationTaskRepository } from '../repositories/optimization-task.repository.js'
import { timelineEngine } from '../workspace/timeline.js'
import { calculateScoreSimple } from '../recommendation/recommendation-score.service.js'

export default async function geoOptimizationV2Routes(fastify: FastifyInstance) {
  // ── helpers ──

  function statusMap(status: string): string {
    return status === 'in_progress' ? 'in_progress' : status === 'done' ? 'done' : 'todo'
  }

  // ── GET /api/geo/optimization/queue?projectId=xxx ──
  fastify.get('/api/geo/optimization/queue', { preHandler: [] }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) return reply.status(400).send({ success: false, error: 'projectId required' })

    const tasks = await generateTasks(projectId)

    // Merge persisted statuses into generated tasks
    const storedStatuses = await optimizationTaskRepository.getStatusesByProject(projectId)
    const statusMapByTask = new Map(storedStatuses.map(s => [s.taskId, s.status]))

    let todoCount = 0
    let inProgressCount = 0
    let doneCount = 0

    const mappedTasks = tasks.map(t => {
      const persistedStatus = statusMapByTask.get(t.title)
      const status = persistedStatus ? statusMap(persistedStatus) : 'todo'

      if (status === 'todo') todoCount++
      else if (status === 'in_progress') inProgressCount++
      else if (status === 'done') doneCount++

      return {
        id: t.title,
        title: t.title,
        description: t.description,
        rootCause: t.reason,
        expectedImpact: {
          discoverability: Math.round(t.impact * 0.4),
          citation: Math.round(t.impact * 0.3),
          coverage: Math.round(t.impact * 0.2),
          visibility: Math.round(t.impact * 0.1),
        },
        difficulty: t.effort === 'EASY' ? 'easy' : t.effort === 'MEDIUM' ? 'medium' : 'hard',
        estimatedTime: t.estimatedImplementationDays <= 1 ? 'today' as const
          : t.estimatedImplementationDays <= 3 ? '3_days' as const
          : '7_days' as const,
        businessValue: { label: t.businessImpact, score: t.confidence },
        aiVisibilityGain: t.estimatedVisibilityGain,
        citationGain: t.estimatedCitationGainPercent,
        confidence: t.confidence >= 70 ? 'high' as const : t.confidence >= 40 ? 'medium' as const : 'low' as const,
        evidence: [{ source: 'GEO Intelligence', summary: t.description }],
        status: status as 'todo' | 'in_progress' | 'done',
        tags: [t.category],
        priority: t.priority === 'HIGH' ? 1 : t.priority === 'MEDIUM' ? 2 : 3,
        category: t.category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })

    return {
      success: true,
      data: {
        projectId,
        totalTasks: tasks.length,
        todoCount,
        inProgressCount,
        doneCount,
        tasks: mappedTasks,
        summary: {
          totalExpectedDiscoverabilityGain: tasks.reduce((s, t) => s + Math.round(t.impact * 0.4), 0),
          totalExpectedCitationGain: tasks.reduce((s, t) => s + Math.round(t.impact * 0.3), 0),
          totalExpectedCoverageGain: tasks.reduce((s, t) => s + Math.round(t.impact * 0.2), 0),
          totalExpectedVisibilityGain: tasks.reduce((s, t) => s + Math.round(t.impact * 0.1), 0),
        },
      },
    }
  })

  // ── GET /api/geo/optimization/tags?projectId=xxx ──
  fastify.get('/api/geo/optimization/tags', { preHandler: [] }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) return reply.status(400).send({ success: false, error: 'projectId required' })

    const tasks = await generateTasks(projectId)

    const tagMap = new Map<string, number>()
    for (const t of tasks) {
      tagMap.set(t.category, (tagMap.get(t.category) || 0) + 1)
    }

    return {
      success: true,
      data: Array.from(tagMap.entries()).map(([key, count]) => ({
        key,
        label: key,
        count,
      })),
    }
  })

  // ── POST /api/geo/optimization/batch/:action ──
  // Supports: start, publish, verify, ignore
  fastify.post('/api/geo/optimization/batch/:action', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { action } = req.params as { action: string }
    const { projectId, taskIds } = req.body as { projectId: string; taskIds: string[] }

    if (!projectId || !taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return reply.status(400).send({ success: false, error: 'projectId and taskIds required' })
    }

    const actionToStatus: Record<string, string> = {
      start: 'in_progress',
      publish: 'done',
      verify: 'done',
      ignore: 'done',
    }

    const newStatus = actionToStatus[action]
    if (!newStatus) {
      return reply.status(400).send({ success: false, error: `Unknown action: ${action}` })
    }

    await optimizationTaskRepository.batchUpsertStatuses(
      projectId,
      taskIds.map(taskId => ({ taskId, status: newStatus }))
    )

    // ── Record timeline events ──
    for (const taskId of taskIds) {
      await timelineEngine.recordOptimizationEvent(projectId, taskId, newStatus, action)
    }

    // ── Trigger Health Recalc (once, after all tasks are committed) ──
    if (action === 'publish' || action === 'verify') {
      // Idempotent: only after execution-affecting actions
      setImmediate(async () => {
        try { await calculateScoreSimple(projectId) } catch (e) { /* non-blocking */ }
      })
    }

    return { success: true, data: { updatedCount: taskIds.length } }
  })

  // ── PATCH /api/geo/optimization/task/:id/status ──
  fastify.patch('/api/geo/optimization/task/:id/status', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { projectId, status } = req.body as { projectId: string; status: string }

    if (!projectId || !status) {
      return reply.status(400).send({ success: false, error: 'projectId and status required' })
    }

    await optimizationTaskRepository.upsertStatus(projectId, id, status)

    // ── Record timeline event ──
    await timelineEngine.recordOptimizationEvent(projectId, id, status, status)

    // ── Trigger Health Recalc (non-blocking, after status update) ──
    if (status === 'done') {
      setImmediate(async () => {
        try { await calculateScoreSimple(projectId) } catch (e) { /* non-blocking */ }
      })
    }

    return { success: true }
  })
}
