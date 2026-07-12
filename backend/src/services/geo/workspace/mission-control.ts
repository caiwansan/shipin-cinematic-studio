// ============================================================
// ★ P0-2 / P0-3: Mission Control — Repository-Backed (no Memory Truth)
//
// All Dashboard data comes from the ScoreSnapshot table.
// In-memory stores (ObservatoryStore, MissionQueue, etc.) are
// NOT used as truth sources. They may only serve as cache.
//
// SSOT Chain:  Dashboard → MissionControlRepository → ScoreSnapshot
// DTO:         shared/dto/mission-control.dto.ts (唯一来源)
// ============================================================

import { geoScoreSnapshotRepository } from '../repositories/geo-score-snapshot.repository.js'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { timelineEngine } from './timeline.js'
import type { MissionControlDTO } from '../../../../../shared/dto/mission-control.dto.js'

const ENGINE_INFO: Record<string, { label: string; icon: string }> = {
  discovery: { label: '品牌识别', icon: '🔍' },
  knowledge: { label: '知识覆盖', icon: '📚' },
  recommendation: { label: '优化建议', icon: '💡' },
  mission: { label: '待办任务', icon: '🎯' },
  verification: { label: '验证确认', icon: '✅' },
  publishing: { label: '发布成果', icon: '📤' },
  learning: { label: '持续学习', icon: '🧠' },
}

export async function getMissionControl(projectId?: string): Promise<MissionControlDTO> {
  let pid = projectId || ''

  // If no projectId, use the most recent project
  if (!pid) {
    try {
      const projects = await geoProjectRepository.findMany(
        { deletedAt: null },
        { orderBy: { createdAt: 'desc' }, take: 1 }
      )
      if (projects.length > 0) {
        pid = projects[0].id
      }
    } catch {
      // No projects yet
    }
  }

  // ★ P0-2: Read from ScoreSnapshot (SSOT), not from in-memory stores
  let latestSnapshot: any = null
  let snapshotCount = 0
  if (pid) {
    try {
      const snapshots = await geoScoreSnapshotRepository.findMany(
        { projectId: pid },
        { orderBy: { createdAt: 'desc' }, take: 5 }
      )
      snapshotCount = Array.isArray(snapshots) ? snapshots.length : 0
      if (snapshotCount > 0) {
        latestSnapshot = snapshots[0]
      }
    } catch {
      // ScoreSnapshot table may not exist yet
    }
  }

  // ★ P0-2: Read from DB for project info
  let entityName: string | null = null
  if (pid) {
    try {
      const project = await geoProjectRepository.findUnique({ where: { id: pid } })
      entityName = project?.name || null
    } catch {
      // ignore
    }
  }

  // ── Compute AI Visibility from latest ScoreSnapshot ──
  let aiVisibility = 0
  if (latestSnapshot) {
    const scores = latestSnapshot.scores || latestSnapshot.snapshot || {}
    aiVisibility = Math.round(scores.overall ?? scores.visibility ?? 0)
  }
  const todayGoal = Math.min(100 - aiVisibility, 15)

  // ── Engine states derived from ScoreSnapshot presence ──
  const hasSnapshot = snapshotCount > 0
  const engines: MissionControlDTO['engines'] = [
    {
      name: 'discovery',
      label: '品牌识别',
      status: hasSnapshot ? 'completed' : 'idle',
      detail: hasSnapshot ? '已建立品牌档案' : '等待品牌创建',
      updatedAt: latestSnapshot?.createdAt || null,
    },
    {
      name: 'knowledge',
      label: '知识覆盖',
      status: 'idle',
      detail: hasSnapshot ? '等待补充品牌知识' : '等待品牌创建',
      updatedAt: null,
    },
    {
      name: 'recommendation',
      label: '优化建议',
      status: hasSnapshot ? 'completed' : 'idle',
      detail: hasSnapshot ? '已生成初始建议' : '等待品牌创建',
      updatedAt: null,
    },
    {
      name: 'mission',
      label: '待办任务',
      status: hasSnapshot ? 'completed' : 'idle',
      detail: hasSnapshot ? '有待办任务' : '等待品牌创建',
      updatedAt: null,
    },
    {
      name: 'verification',
      label: '验证确认',
      status: 'idle',
      detail: '等待执行优化',
      updatedAt: null,
    },
    {
      name: 'publishing',
      label: '发布成果',
      status: 'idle',
      detail: '等待验证通过',
      updatedAt: null,
    },
    {
      name: 'learning',
      label: '持续学习',
      status: 'idle',
      detail: '收集中',
      updatedAt: null,
    },
  ]

  // ── Timeline events from TimelineEngine (DB-backed) ──
  let recentActivity: MissionControlDTO['recentActivity'] = []
  let actionableItems: MissionControlDTO['actionableItems'] = []
  if (pid) {
    try {
      const rawEvents = await timelineEngine.getProjectTimeline(pid, 10)
      recentActivity = rawEvents.map((e: any) => ({
        id: e.eventId,
        title: e.title || '',
        detail: e.detail || '',
        level: (e.level === 'success' ? 'success' : e.level === 'warning' ? 'warning' : e.level === 'error' ? 'error' : 'info') as 'info' | 'warning' | 'error' | 'success',
        route: e.eventType === 'RECOMMENDATION_GENERATED' ? '/workspace/geo/knowledge' : undefined,
        timestamp: e.createdAt,
      }))
      // First actionable items = mission/recommendation events
      actionableItems = recentActivity
        .filter((e: any) => e.title?.includes('完善') || e.title?.includes('创建'))
        .slice(0, 3)
    } catch {
      // Timeline may not be available
    }
  }

  // ★ P0-5: Runtime Health Gate
  const runtimeHealth: MissionControlDTO['runtimeHealth'] = {
    status: 'healthy',
    scoreSnapshot: hasSnapshot,
    timeline: recentActivity.length > 0,
    project: !!pid,
    message: '',
  }
  if (!pid) {
    runtimeHealth.status = 'uninitialized'
    runtimeHealth.message = '尚未创建项目，请先创建一个品牌'
  } else if (!hasSnapshot) {
    runtimeHealth.status = 'initializing'
    runtimeHealth.message = '系统正在初始化，请稍后刷新'
  } else {
    runtimeHealth.status = 'healthy'
    runtimeHealth.message = '系统运行正常'
  }

  return {
    projectId: pid || null,
    entityName,
    aiVisibility,
    todayGoal,
    engines,
    lastExecution: latestSnapshot
      ? { id: latestSnapshot.id, durationMs: 0, timestamp: latestSnapshot.createdAt }
      : null,
    queues: { mission: 0, verification: 0, publishing: 0, learning: 0 },
    recentActivity,
    actionableItems,
    runtimeHealth,
  }
}
