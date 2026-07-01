// ============================================================
// Score Timeline Service — Historical score data
// Returns timeline points from GeoScoreSnapshot table
// ============================================================

import { geoScoreSnapshotRepository } from '../repositories/geo-score-snapshot.repository.js'
import { geoBrandProfileRepository } from '../repositories/geo-brand-profile.repository.js'
import { geoEntityRepository } from '../repositories/geo-entity.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { knowledgeObjectRepository } from '../../repositories/knowledge-object.repository.js'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'

export interface TimelinePoint {
  date: string   // ISO date string (YYYY-MM-DD)
  score: number
}

export async function getTimeline(
  projectId: string,
  range: '7d' | '30d' | '90d' | '1y' = '7d'
): Promise<TimelinePoint[]> {
  // Determine date range
  const now = new Date()
  const rangeMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
  const days = rangeMap[range] || 7
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  // Try fetching from GeoScoreSnapshot table first
  const snapshots = await geoScoreSnapshotRepository.findMany(
    { projectId, createdAt: { gte: since } },
    {
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        snapshot: true,
      },
    }
  )

  if (snapshots.length > 0) {
    // Group by day and average
    const byDay = new Map<string, number[]>()
    for (const snap of snapshots) {
      const dayStr = snap.createdAt.toISOString ? new Date(snap.createdAt).toISOString().slice(0, 10) : String(snap.createdAt).slice(0, 10)
      if (!byDay.has(dayStr)) byDay.set(dayStr, [])
      const snapshotData = snap.snapshot as Record<string, any>
      const overall = typeof snapshotData === 'object' && snapshotData !== null
        ? (snapshotData.overall ?? snapshotData.score ?? 0)
        : typeof snapshotData === 'number'
          ? snapshotData
          : 0
      byDay.get(dayStr)!.push(overall)
    }

    const points: TimelinePoint[] = []
    const sortedDays = Array.from(byDay.keys()).sort()
    for (const day of sortedDays) {
      const vals = byDay.get(day)!
      const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
      points.push({ date: day, score: avg })
    }

    // Fill in missing days with previous value (forward fill)
    return fillMissingDays(points, since, now)
  }

  // No snapshots found — return estimated data based on current score and data accumulation
  return generateEstimatedTimeline(projectId, since, now)
}

/**
 * Forward-fill missing days so the timeline is continuous
 */
function fillMissingDays(points: TimelinePoint[], since: Date, now: Date): TimelinePoint[] {
  if (points.length === 0) return points

  const result: TimelinePoint[] = []
  const current = new Date(since)
  let lastScore = points[0].score
  let pointIdx = 0

  while (current <= now) {
    const dayStr = current.toISOString().slice(0, 10)

    // Advance pointIdx to match or pass this day
    while (pointIdx < points.length && points[pointIdx].date < dayStr) {
      lastScore = points[pointIdx].score
      pointIdx++
    }

    if (pointIdx < points.length && points[pointIdx].date === dayStr) {
      lastScore = points[pointIdx].score
      pointIdx++
    }

    result.push({ date: dayStr, score: lastScore })
    current.setDate(current.getDate() + 1)
  }

  return result
}

/**
 * Generate estimated historical timeline when no snapshots exist.
 * Uses data growth pattern: score grows as data accumulates.
 */
async function generateEstimatedTimeline(
  projectId: string,
  since: Date,
  now: Date
): Promise<TimelinePoint[]> {
  // Get the earliest available data creation dates
  const [earliestBrand, earliestEntities, earliestKO, project] = await Promise.all([
    geoBrandProfileRepository.findFirst({ projectId }, { orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    geoEntityRepository.findFirst({ projectId }, { orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    knowledgeObjectRepository.findFirst({ projectId }, { orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    geoProjectRepository.findFirst({ id: projectId }, { select: { createdAt: true } }),
  ])

  const projectStart = (project?.createdAt ? new Date(project.createdAt) : null)
    || (earliestBrand?.createdAt ? new Date(earliestBrand.createdAt) : null)
    || (earliestEntities?.createdAt ? new Date(earliestEntities.createdAt) : null)
    || (earliestKO?.createdAt ? new Date(earliestKO.createdAt) : null)
    || now
  const startDate = new Date(Math.max(since.getTime(), projectStart.getTime()))

  // Count total data
  const [totalBrands, totalEntities, totalKO, totalScans] = await Promise.all([
    geoBrandProfileRepository.count({ where: { projectId } }),
    geoEntityRepository.count({ where: { projectId } }),
    knowledgeObjectRepository.count({ where: { projectId } }),
    geoScanHistoryRepository.count({ where: { projectId } }),
  ])

  const totalDays = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
  const daysSince = Math.max(1, Math.round((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)))

  // Estimate current score
  const currentScore = await getCurrentSimpleScore(projectId)

  // Simulate linear growth from 0 to current score
  const points: TimelinePoint[] = []
  for (let i = 0; i < daysSince; i++) {
    const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000)
    const dayStr = day.toISOString().slice(0, 10)
    const progress = Math.min(1, (i + 1) / totalDays)
    const estimatedScore = Math.round(currentScore * progress)
    points.push({ date: dayStr, score: estimatedScore })
  }

  if (points.length > 0) {
    points[points.length - 1].score = currentScore
  }

  return points
}

async function getCurrentSimpleScore(projectId: string): Promise<number> {
  try {
    const { calculateScore } = await import('./recommendation-score.service.js')
    const result = await calculateScore(projectId)
    return result.overall
  } catch {
    return 0
  }
}
