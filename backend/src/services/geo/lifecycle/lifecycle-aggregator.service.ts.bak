import { PrismaClient } from '@prisma/client'
import type { LifecycleEvent, LifecycleTimeline } from './lifecycle.types'

export class LifecycleAggregator {
  constructor(private prisma: PrismaClient) {}

  async getTimeline(projectId: string, limit = 50): Promise<LifecycleTimeline> {
    const events: LifecycleEvent[] = []

    // 1. Optimization executions (optimize phase)
    const executions = await this.prisma.optimizationExecution.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    })
    for (const exec of executions) {
      events.push({
        id: `opt-${exec.id}`,
        projectId,
        phase: 'optimize',
        timestamp: exec.startedAt,
        status: exec.executionStatus,
        detail: { optimizationType: exec.optimizationType, triggerSource: exec.triggerSource },
      })
    }

    // 2. Verification results (verify phase)
    const results = await this.prisma.verificationResult.findMany({
      where: { projectId },
      orderBy: { verifiedAt: 'desc' },
      take: 20,
    })
    for (const r of results) {
      events.push({
        id: `ver-${r.id}`,
        projectId,
        phase: 'verify',
        timestamp: r.verifiedAt,
        status: r.isImprovement ? 'improved' : 'no_change',
        detail: { executionId: r.executionId, delta: r.deltaWhenVerified },
      })
    }

    // 3. Publishing records (publish / observe / indexed phases)
    const publishes = await this.prisma.publishingRecord.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    for (const p of publishes) {
      // Map status to phase
      let phase: LifecycleEvent['phase'] = 'publish'
      if (p.status === 'verified_online') phase = 'observe'
      else if (p.status === 'indexed') phase = 'indexed'
      else if (p.status === 'rolled_back') phase = 'publish'

      events.push({
        id: `pub-${p.id}`,
        projectId,
        phase,
        timestamp: p.createdAt,
        status: p.status,
        detail: { platform: p.platform, contentType: p.contentType },
      })

      // Add indexed event at publishedAt
      if (p.publishedAt && (p.status === 'verified_online' || p.status === 'indexed')) {
        events.push({
          id: `pub-${p.id}-online`,
          projectId,
          phase: 'observe',
          timestamp: p.publishedAt,
          status: 'verified_online',
          detail: { platform: p.platform },
        })
      }
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Build summary
    const phaseCounts: Record<string, number> = {}
    for (const e of events) {
      phaseCounts[e.phase] = (phaseCounts[e.phase] || 0) + 1
    }

    const phases = ['optimize', 'verify', 'publish', 'observe', 'indexed', 'drift', 'recommend']
    let currentPhase = 'optimize'
    for (const phase of phases) {
      if (phaseCounts[phase] && phaseCounts[phase] > 0) {
        currentPhase = phase
      }
    }

    return {
      projectId,
      events: events.slice(0, limit),
      summary: {
        totalEvents: events.length,
        currentPhase,
        lastEventTime: events[0]?.timestamp,
        phases: phaseCounts,
      },
    }
  }
}
