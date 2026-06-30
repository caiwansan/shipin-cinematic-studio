import { PrismaClient } from '@prisma/client'

export interface TimelineEvent {
  id: string
  projectId: string
  type: string
  timestamp: Date
  detail: Record<string, any>
}

export class TimelineService {
  constructor(private prisma: PrismaClient) {}

  async getTimeline(projectId: string, limit = 20): Promise<TimelineEvent[]> {
    const executions = await this.prisma.optimizationExecution.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    })

    const events: TimelineEvent[] = []

    for (const exec of executions) {
      // Execution started
      events.push({
        id: `exec-start-${exec.id}`,
        projectId,
        type: 'execution.started',
        timestamp: exec.startedAt,
        detail: { executionId: exec.id, optimizationType: exec.optimizationType, triggerSource: exec.triggerSource },
      })

      // Execution completed
      if (exec.completedAt) {
        events.push({
          id: `exec-done-${exec.id}`,
          projectId,
          type: 'execution.completed',
          timestamp: exec.completedAt,
          detail: { executionId: exec.id, scoreDelta: exec.scoreDelta },
        })
      }

      // Verification completed
      if (exec.verifiedAt) {
        events.push({
          id: `veri-done-${exec.id}`,
          projectId,
          type: 'verification.completed',
          timestamp: exec.verifiedAt,
          detail: {
            executionId: exec.id,
            beforeScore: exec.beforeScore,
            afterScore: exec.afterScore,
            delta: exec.scoreDelta,
            status: exec.verificationStatus,
          },
        })
      }
    }

    // Also check for publishing records (future)
    try {
      const publishes = await this.prisma.publishingRecord.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      for (const pub of publishes) {
        events.push({
          id: `pub-status-${pub.id}`,
          projectId,
          type: `publishing.${pub.status}`,
          timestamp: pub.createdAt,
          detail: { publishId: pub.id, platform: pub.platform, contentType: pub.contentType, status: pub.status },
        })
      }
    } catch {
      // Publishing table may not have data yet — fine
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return events.slice(0, limit)
  }
}
