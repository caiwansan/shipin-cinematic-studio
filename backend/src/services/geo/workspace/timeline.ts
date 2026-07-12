// ============================================================
// Timeline Engine — GEO Workspace 事件投影（Projection）
//
// Timeline 不是数据源，是投影（Projection）。
// 所有业务引擎（Optimization / Knowledge / Verification / Health）
// 产生的事件，由 Timeline Engine 统一读取并投影为业务时间轴。
//
// 架构约束（ADR-P0-3）：
//   1. Timeline 是 Projection，不是 Source
//   2. 统一 TimelineEventType 枚举
//   3. 外部只通过 GET /api/geo/timeline 读取
// ============================================================

import { prisma } from '../../../utils/index.js'

// ── TimelineEventType — 统一枚举（Constitution v2.0 第十章 10.2）──
// 13 种统一事件类型覆盖所有 Engine 的 Timeline 记录需求
export type TimelineEventType =
  // Presence Engine
  | 'SCAN_STARTED'
  | 'SCAN_PROVIDER_COMPLETED'
  | 'SCAN_COMPLETED'
  // Discovery Engine
  | 'DISCOVERY_COMPLETED'
  // Knowledge Engine
  | 'KNOWLEDGE_UPDATED'
  // Score Engine
  | 'SNAPSHOT_CREATED'
  | 'SCORE_RECALCULATED'
  // Recommendation Engine
  | 'RECOMMENDATION_GENERATED'
  // Optimization Engine
  | 'OPTIMIZATION_EXECUTED'
  // Verification Engine
  | 'VERIFICATION_COMPLETED'
  // Growth Engine
  | 'GROWTH_UPDATED'
  // Publishing Engine
  | 'PUBLISH_COMPLETED'
  // Explain Engine
  | 'EXPLAIN_GENERATED'

/**
 * ⚠️ 废弃的旧事件类型（向前兼容映射）
 * P0-5.4 统一后新代码禁止使用以下类型
 */
export type LegacyTimelineEventType =
  | 'PROJECT_CREATED'
  | 'KNOWLEDGE_IMPORTED'
  | 'OPTIMIZATION_STARTED'
  | 'OPTIMIZATION_IGNORED'
  | 'HEALTH_RECALCULATED'
  | 'PUBLISHING_STARTED'
  | 'PUBLISHING_COMPLETED'

// ── TimelineEvent — 统一事件模型（Constitution v2.0 第十章 10.1）──
// 所有 Engine 必须使用此格式记录 Timeline 事件
export interface TimelineEvent {
  eventId: string          // UUID
  projectId: string        // 所属项目
  engine: string           // 产生事件的 Engine 名称
  entity: string           // 关联实体类型
  eventType: string        // 统一事件类型
  title?: string           // 人类可读标题（optional，仅用于投影展示）
  detail?: string          // 详细描述（optional）
  snapshotId?: string      // 关联 Snapshot ID
  level?: 'info' | 'success' | 'warning' | 'error'
  payload: Record<string, any>
  createdAt: string        // ISO timestamp
}

// ── Event type → human-readable config ──
const EVENT_CONFIG: Record<string, { icon: string; level: 'info' | 'success' | 'warning' | 'error' }> = {
  // Presence Engine
  SCAN_STARTED:             { icon: '🔍', level: 'info' },
  SCAN_PROVIDER_COMPLETED:  { icon: '✅', level: 'info' },
  SCAN_COMPLETED:           { icon: '✅', level: 'success' },
  // Discovery Engine
  DISCOVERY_COMPLETED:      { icon: '🌐', level: 'info' },
  // Knowledge Engine
  KNOWLEDGE_UPDATED:        { icon: '📝', level: 'info' },
  // Score Engine
  SNAPSHOT_CREATED:         { icon: '📸', level: 'info' },
  SCORE_RECALCULATED:       { icon: '📊', level: 'info' },
  // Recommendation Engine
  RECOMMENDATION_GENERATED: { icon: '💡', level: 'info' },
  // Optimization / Growth Engine
  OPTIMIZATION_EXECUTED:    { icon: '✅', level: 'success' },
  // Verification Engine
  VERIFICATION_COMPLETED:   { icon: '🔍', level: 'info' },
  // Growth Engine
  GROWTH_UPDATED:           { icon: '📈', level: 'info' },
  // Publishing Engine
  PUBLISH_COMPLETED:        { icon: '📤', level: 'success' },
  // Explain Engine
  EXPLAIN_GENERATED:        { icon: '💬', level: 'info' },
  // Legacy compatibility
  OPTIMIZATION_STARTED:     { icon: '▶️', level: 'info' },
  OPTIMIZATION_IGNORED:     { icon: '⏭️', level: 'info' },
  HEALTH_RECALCULATED:      { icon: '📊', level: 'info' },
  PUBLISHING_STARTED:       { icon: '📤', level: 'info' },
  PUBLISHING_COMPLETED:     { icon: '✅', level: 'success' },
}

// ── TimelineEngine — 从 DB 投影事件 ──
// 每个业务引擎产生自己的持久化记录（如 optimization_tasks / optimization_executions），
// TimelineEngine 读取这些记录并投影为统一的 TimelineEvent[]
export class TimelineEngine {
  /**
   * 统一事件记录入口（Constitution v2.0 第十章 10.1）
   *
   * 所有 Engine 必须通过此方法记录 Timeline 事件。
   * 格式与 Constitution 完全一致：
   *   timelineEngine.record('SCAN_COMPLETED', {
   *     projectId, engine: 'presence', entity: 'project',
   *     snapshotId: '...',
   *     payload: { ... }
   *   })
   */
  async record(
    eventType: string,
    opts: {
      projectId: string
      engine: string
      entity: string
      snapshotId?: string
      title?: string
      detail?: string
      level?: 'info' | 'success' | 'warning' | 'error'
      payload?: Record<string, any>
      createdAt?: string
    },
  ): Promise<string> {
    const eventId = `evt-${opts.projectId}-${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const createdAt = opts.createdAt || new Date().toISOString()

    const event: TimelineEvent = {
      eventId,
      projectId: opts.projectId,
      engine: opts.engine,
      entity: opts.entity,
      eventType,
      title: opts.title,
      detail: opts.detail,
      snapshotId: opts.snapshotId,
      level: opts.level || 'info',
      payload: opts.payload || {},
      createdAt,
    }

    // Persist to database if timeline table exists, otherwise console log
    try {
      // Try to use the geoTimelineEvent table if available via Prisma
      if ((prisma as any).geoTimelineEvent?.create) {
        await (prisma as any).geoTimelineEvent.create({
          data: {
            eventId,
            projectId: opts.projectId,
            engine: opts.engine,
            entity: opts.entity,
            eventType,
            snapshotId: opts.snapshotId,
            payload: opts.payload || {},
            level: opts.level || 'info',
            createdAt: new Date(createdAt),
          },
        })
      }
    } catch {
      // Timeline persistence is non-fatal — events can be projected
      // from source tables (snapshots, optimization_executions, etc.)
    }

    return eventId
  }

  /**
   * 获取项目的时间线事件（投影）
   * 从多个业务表读取数据，按时间排序，投影为 TimelineEvent[]
   */
  async getProjectTimeline(projectId: string, limit = 50): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = []

    // 1. 从 optimization_tasks 投影 OPTIMIZATION_* 事件
    const tasks = await prisma.$queryRawUnsafe<Array<{
      task_id: string
      status: string
      updated_at: Date
      created_at: Date
    }>>(
      `SELECT task_id, status, updated_at, created_at
       FROM optimization_tasks
       WHERE project_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      projectId,
      limit
    )

    for (const task of tasks) {
      if (task.status === 'in_progress') {
        events.push(this.makeEvent({
          projectId,
          eventType: 'OPTIMIZATION_EXECUTED',
          engine: 'growth',
          entity: 'task',
          entityId: task.task_id,
          title: `优化开始：${task.task_id}`,
          detail: `任务 "${task.task_id}" 开始执行`,
          level: 'info',
          createdAt: task.updated_at.toISOString(),
          payload: { status: task.status },
        }))
      } else if (task.status === 'done') {
        events.push(this.makeEvent({
          projectId,
          eventType: 'OPTIMIZATION_EXECUTED',
          engine: 'growth',
          entity: 'task',
          entityId: task.task_id,
          title: `优化完成：${task.task_id}`,
          detail: `任务 "${task.task_id}" 执行完成`,
          level: 'success',
          createdAt: task.updated_at.toISOString(),
          payload: { status: task.status },
        }))
      }
    }

    // 2. 从 optimization_executions 投影更完整的执行事件
    try {
      const executions = await prisma.optimizationExecution.findMany({
        where: { projectId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          optimizationType: true,
          executionStatus: true,
          triggerSource: true,
          startedAt: true,
          completedAt: true,
          scoreDelta: true,
        },
      })

      for (const exec of executions) {
        if (exec.startedAt) {
          events.push(this.makeEvent({
            projectId,
            eventType: 'OPTIMIZATION_EXECUTED',
            engine: 'growth',
            entity: 'execution',
            entityId: exec.id,
            title: `执行 ${exec.optimizationType} 优化`,
            detail: `${exec.optimizationType} 优化${exec.executionStatus === 'completed' ? '已完成' : '已启动'}`,
            level: exec.executionStatus === 'completed' ? 'success' : 'info',
            createdAt: exec.startedAt.toISOString(),
            payload: {
              optimizationType: exec.optimizationType,
              executionStatus: exec.executionStatus,
              triggerSource: exec.triggerSource,
              scoreDelta: exec.scoreDelta,
            },
          }))
        }
      }
    } catch {
      // optimization_executions 表可能不存在，静默跳过
    }

    // 3. 从 GEOScoreSnapshot 投影 Score / Health 事件
    try {
      const snapshots = await prisma.gEOScoreSnapshot.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          snapshot: true,
          scores: true,
          metadata: true,
          createdAt: true,
          scanId: true,
          sourceType: true,
          engineVersion: true,
          scoreVersion: true,
        },
      })

      for (const snap of snapshots) {
        const scores = (snap.snapshot || snap.scores || {}) as any
        const overall = scores.overall ?? 0
        events.push(this.makeEvent({
          projectId,
          eventType: 'SNAPSHOT_CREATED',
          engine: 'score',
          entity: 'snapshot',
          entityId: snap.id,
          title: `健康分已更新：${overall}`,
          detail: `健康分当前为 ${overall}/100${
            snapshots.indexOf(snap) < snapshots.length - 1
              ? `（较上次变化：${overall - ((snapshots[snapshots.indexOf(snap) + 1]?.snapshot as any)?.overall ?? 0) > 0 ? '+' : ''}${overall - ((snapshots[snapshots.indexOf(snap) + 1]?.snapshot as any)?.overall ?? 0)}）`
              : ''
          }`,
          level: 'info',
          createdAt: snap.createdAt.toISOString(),
          payload: { overall, dimensions: scores, sourceType: snap.sourceType },
          snapshotId: snap.id,
        }))
      }
    } catch {
      // GEOScoreSnapshot 表可查询但非必需，静默跳过
    }

    // 4. 从 geoTimelineEvent 表读取已记录的统一事件（如果有）
    try {
      const persistedEvents = await (prisma as any).geoTimelineEvent?.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      if (persistedEvents) {
        for (const pe of persistedEvents) {
          events.push({
            eventId: pe.eventId,
            projectId: pe.projectId,
            engine: pe.engine,
            entity: pe.entity,
            eventType: pe.eventType,
            title: pe.title,
            detail: pe.detail,
            snapshotId: pe.snapshotId,
            level: pe.level || 'info',
            payload: (pe.payload as Record<string, any>) || {},
            createdAt: pe.createdAt instanceof Date ? pe.createdAt.toISOString() : pe.createdAt,
          })
        }
      }
    } catch {
      // geoTimelineEvent 表可能不存在，静默跳过
    }

    // 5. 去重（按 eventId）并按时间排序
    return this.dedupeAndSort(events, limit)
  }

  /**
   * @deprecated P0-5.4 — 使用统一 record() 代替
   * 保留向后兼容直到所有调用方迁移完成
   */
  async recordOptimizationEvent(
    projectId: string,
    taskId: string,
    status: string,
    action: string
  ): Promise<void> {
    await this.record('OPTIMIZATION_EXECUTED', {
      projectId,
      engine: 'growth',
      entity: 'task',
      payload: { taskId, status, action },
      title: status === 'in_progress' ? `优化开始：${taskId}` : `优化完成：${taskId}`,
    })

    // Also upsert into optimization_executions for projection
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO optimization_executions (id, project_id, optimization_type, execution_status, trigger_source, started_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO NOTHING
        `,
        `tl-${projectId}-${taskId}-${Date.now()}`,
        projectId,
        taskId,
        status === 'in_progress' ? 'in_progress' : 'completed',
        action
      )
    } catch {
      // optimization_executions 可能不支持 ON CONFLICT，静默跳过
    }
  }

  /**
   * @deprecated P0-5.4 — 使用统一 record() 代替
   * 保留向后兼容直到所有调用方迁移完成
   */
  async recordHealthRecalculated(opts: {
    projectId: string
    metadata: {
      overall: number
      dimensions: Record<string, number>
      change: number
    }
  }): Promise<void> {
    await this.record('SCORE_RECALCULATED', {
      projectId: opts.projectId,
      engine: 'score',
      entity: 'health',
      payload: opts.metadata as Record<string, any>,
      title: `健康分已更新：${opts.metadata.overall}`,
    })
  }

  // ── Private helpers ──

  private makeEvent(opts: {
    projectId: string
    eventType: string
    engine: string
    entity: string
    entityId?: string
    title: string
    detail: string
    level: 'info' | 'success' | 'warning' | 'error'
    createdAt: string
    payload?: Record<string, any>
    snapshotId?: string
  }): TimelineEvent {
    const eventId = `${opts.eventType}-${opts.projectId}-${opts.entityId || opts.createdAt}-${opts.createdAt}`
    return {
      eventId,
      projectId: opts.projectId,
      engine: opts.engine,
      entity: opts.entity,
      eventType: opts.eventType,
      title: opts.title,
      detail: opts.detail,
      snapshotId: opts.snapshotId,
      level: opts.level,
      payload: opts.payload || {},
      createdAt: opts.createdAt,
    }
  }

  private dedupeAndSort(events: TimelineEvent[], limit: number): TimelineEvent[] {
    const seen = new Set<string>()
    const deduped: TimelineEvent[] = []

    for (const event of events) {
      if (!seen.has(event.eventId)) {
        seen.add(event.eventId)
        deduped.push(event)
      }
    }

    return deduped
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  }
}

// ── Singleton export ──
export const timelineEngine = new TimelineEngine()
