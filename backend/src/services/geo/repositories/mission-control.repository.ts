// ============================================================
// ★ P0-6: MissionControlRepository — Dashboard SSOT
//
// Wraps all DB reads needed by the Dashboard into one call.
// Service → MissionControlRepository → Prisma
// ============================================================

import { geoScoreSnapshotRepository } from './geo-score-snapshot.repository.js'
import { geoProjectRepository } from './geo-project.repository.js'
import { timelineEngine } from '../workspace/timeline.js'

export type RuntimeHealthStatus = 'healthy' | 'initializing' | 'uninitialized'

export interface DashboardData {
  projectId: string | null
  entityName: string | null
  aiVisibility: number
  todayGoal: number
  latestSnapshot: any | null
  snapshotCount: number
  recentActivity: any[]
  /** Runtime Health Gate signals */
  runtimeHealth: {
    status: RuntimeHealthStatus
    scoreSnapshot: boolean
    timeline: boolean
    project: boolean
    message: string
  }
}

export const missionControlRepository = {
  /**
   * Load all Dashboard data from DB in one go.
   * Uses the provided projectId, or falls back to the most recent project.
   */
  async loadDashboard(projectId?: string): Promise<DashboardData> {
    let pid = projectId || ''
    let entityName: string | null = null

    // Resolve project
    if (!pid) {
      try {
        const projects = await geoProjectRepository.findMany(
          { deletedAt: null },
          { createdAt: 'desc' }
        )
        if (projects.length > 0) {
          pid = projects[0].id
          entityName = projects[0].name || null
        }
      } catch {
        // No projects
      }
    } else {
      try {
        const project = await geoProjectRepository.findUnique({ where: { id: pid } })
        entityName = project?.name || null
      } catch {
        // ignore
      }
    }

    // ScoreSnapshot
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
        // Table may not exist
      }
    }

    // AI Visibility
    let aiVisibility = 0
    if (latestSnapshot) {
      const scores = latestSnapshot.scores || latestSnapshot.snapshot || {}
      aiVisibility = Math.round(scores.overall ?? scores.visibility ?? 0)
    }
    const todayGoal = Math.min(100 - aiVisibility, 15)

    // Timeline
    let recentActivity: any[] = []
    if (pid) {
      try {
        recentActivity = await timelineEngine.getProjectTimeline(pid, 10)
      } catch {
        // not available
      }
    }

    // Runtime Health
    const hasSnapshot = snapshotCount > 0
    const hasTimeline = recentActivity.length > 0
    const hasProject = !!pid
    let status: RuntimeHealthStatus = 'healthy'
    let message = '系统运行正常'
    if (!hasProject) {
      status = 'uninitialized'
      message = '尚未创建项目，请先创建一个品牌'
    } else if (!hasSnapshot) {
      status = 'initializing'
      message = '系统正在初始化，请稍后刷新'
    }

    return {
      projectId: pid || null,
      entityName,
      aiVisibility,
      todayGoal,
      latestSnapshot,
      snapshotCount,
      recentActivity,
      runtimeHealth: {
        status,
        scoreSnapshot: hasSnapshot,
        timeline: hasTimeline,
        project: hasProject,
        message,
      },
    }
  },
}
