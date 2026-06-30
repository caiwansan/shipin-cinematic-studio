import { PrismaClient } from '@prisma/client'
import { probeRegistry } from './probes/probe-registry'
import { eventBus } from '../../../platform/event-bus'
import { validateTransition } from '../../../platform/state-machine'
import type { ProbeTarget, ProbeResult, ObservationRecordDTO, DriftCheckResult } from './monitor.types'
import { calculateScore } from '../recommendation/recommendation-score.service.js'

export class MonitorEngine {
  constructor(private prisma: PrismaClient) {
    // Auto-discover probes on construction
    this.discoverProbes()
  }

  private async discoverProbes(): Promise<void> {
    // Only discover if registry is empty
    if (probeRegistry.getNames().length === 0) {
      try {
        await probeRegistry.discover()
        console.log(`[MonitorEngine] Discovered probes: ${probeRegistry.getNames().join(', ')}`)
      } catch (err: any) {
        console.warn(`[MonitorEngine] Probe discovery failed: ${err.message}`)
      }
    }
  }

  /**
   * Execute publishing health check
   */
  async checkPublished(publishId: string, platform: string): Promise<ProbeResult> {
    const record = await this.prisma.publishingRecord.findUnique({ where: { id: publishId } })
    if (!record) throw new Error(`Publish record ${publishId} not found`)

    // Find appropriate probe based on platform
    const probe = probeRegistry.findSupports(platform)[0] || probeRegistry.resolve('http')

    const target: ProbeTarget = {
      projectId: record.projectId,
      publishId,
      platform,
    }

    const result = await probe.execute(target)

    // Record observation — uses PublishingRecord table with adapterType prefix 'probe:'
    await this.prisma.publishingRecord.create({
      data: {
        projectId: record.projectId,
        executionId: publishId,
        platform: 'observation',
        adapterType: `probe:${probe.name}`,
        contentType: 'observation',
        content: { result, checkedAt: new Date() } as any,
        status: result.success ? 'verified_online' : 'failed',
      },
    })

    // If successful, advance publishing record status
    if (result.success) {
      const transition = validateTransition('publishing', record.status, 'verified_online')
      if (transition.allowed) {
        await this.prisma.publishingRecord.update({
          where: { id: publishId },
          data: { status: 'verified_online' },
        })

        await eventBus.publish({
          type: 'publishing.verified_online',
          source: 'MonitorEngine',
          payload: { publishId, projectId: record.projectId, platform },
        })
      }
    }

    return result
  }

  /**
   * Check search engine index status
   */
  async checkIndexed(publishId: string): Promise<ProbeResult> {
    const record = await this.prisma.publishingRecord.findUnique({ where: { id: publishId } })
    if (!record) throw new Error(`Publish record ${publishId} not found`)

    if (record.status !== 'verified_online') {
      return { success: false, error: `Cannot check index: record is ${record.status}`, checkedAt: new Date() }
    }

    const probe = probeRegistry.resolve('index')
    const result = await probe.execute({ projectId: record.projectId, publishId })

    // Record observation
    if (result.success) {
      const transition = validateTransition('publishing', record.status, 'indexed')
      if (transition.allowed) {
        await this.prisma.publishingRecord.update({
          where: { id: publishId },
          data: { status: 'indexed' },
        })

        await eventBus.publish({
          type: 'publishing.indexed',
          source: 'MonitorEngine',
          payload: { publishId, projectId: record.projectId },
        })
      }
    }

    return result
  }

  /**
   * Drift detection — check if project score has changed significantly
   */
  async checkDrift(projectId: string, threshold = 2.0): Promise<DriftCheckResult> {
    // Get current score
    const currentScore = await calculateScore(projectId)
    const currentOverall = currentScore.overall

    // Get latest snapshot to compare
    const latestSnapshot = await this.prisma.gEOScoreSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    const previousScore = latestSnapshot
      ? ((latestSnapshot.snapshot as any)?.overall || currentOverall)
      : currentOverall

    const delta = currentOverall - previousScore
    const isDrift = Math.abs(delta) >= threshold

    const result: DriftCheckResult = {
      projectId,
      currentScore: currentOverall,
      previousScore,
      delta,
      isDrift,
      threshold,
      dimensions: {
        visibility: currentScore.breakdown.visibility.score,
        authority: currentScore.breakdown.authority.score,
        content: currentScore.breakdown.content.score,
        website: currentScore.breakdown.website.score,
        knowledge: currentScore.breakdown.knowledge.score,
      },
      checkedAt: new Date(),
    }

    if (isDrift) {
      await eventBus.publish({
        type: 'monitor.score_drift',
        source: 'MonitorEngine',
        payload: { projectId, delta, currentScore: currentOverall, previousScore, threshold },
      })
    }

    return result
  }

  /**
   * Get observation history for a publish record
   */
  async getObservations(publishId: string): Promise<ObservationRecordDTO[]> {
    const records = await this.prisma.publishingRecord.findMany({
      where: { executionId: publishId, adapterType: { startsWith: 'probe:' } },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(r => ({
      id: r.id,
      projectId: r.projectId,
      publishId: r.executionId || undefined,
      probeType: r.adapterType.replace('probe:', ''),
      success: r.status === 'verified_online',
      details: r.content as Record<string, any>,
      checkedAt: r.createdAt,
    }))
  }
}
