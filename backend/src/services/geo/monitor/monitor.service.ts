import type { PrismaClient } from '@prisma/client'
import { MonitorEngine } from './monitor-engine'
import type { DriftCheckResult } from './monitor.types'
import { prisma } from '../../../utils/index.js'

export class MonitorService {
  private engine: MonitorEngine
  private prisma: PrismaClient

  constructor(prismaClient?: PrismaClient, engine?: MonitorEngine) {
    this.prisma = prismaClient || prisma
    this.engine = engine || new MonitorEngine(this.prisma)
  }

  async checkPublished(publishId: string, platform: string) {
    return this.engine.checkPublished(publishId, platform)
  }

  async checkIndexed(publishId: string) {
    return this.engine.checkIndexed(publishId)
  }

  async checkDrift(projectId: string, threshold?: number): Promise<DriftCheckResult> {
    return this.engine.checkDrift(projectId, threshold)
  }

  async getObservations(publishId: string) {
    return this.engine.getObservations(publishId)
  }

  /**
   * Get health dashboard for a project
   */
  async getHealthDashboard(projectId: string) {
    // Get latest publishing records
    const publishes = await this.prisma.publishingRecord.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const total = publishes.length
    const indexed = publishes.filter(p => p.status === 'indexed').length
    const verified = publishes.filter(p => p.status === 'verified_online' || p.status === 'indexed').length
    const failed = publishes.filter(p => p.status === 'failed').length

    // Get latest score for drift trend
    const latestSnapshot = await this.prisma.gEOScoreSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    const currentScore = latestSnapshot ? (latestSnapshot.snapshot as any)?.overall : undefined

    return {
      projectId,
      publishingHealth: {
        total,
        verified,
        indexed,
        failed,
        indexedPercentage: total > 0 ? Math.round((indexed / total) * 100) : 0,
      },
      currentScore,
      activeAlerts: failed > 0 ? [`${failed} publishing(s) failed`] : [],
      lastObservation: publishes[0] ? { status: publishes[0].status, at: publishes[0].createdAt } : null,
    }
  }
}
