import { PrismaClient } from '@prisma/client'
import { scoreProject } from './geo-scorer-integration'
import type { ScorerResult } from './geo-scorer-integration'

export class SnapshotService {
  constructor(private prisma: PrismaClient) {}

  async createSnapshot(projectId: string, executionId: string): Promise<{ id: string; score: number; dimensions: any }> {
    // Score the project
    const result = await scoreProject(projectId)

    // Create snapshot record
    const snapshot = await this.prisma.gEOScoreSnapshot.create({
      data: {
        projectId,
        snapshot: {
          overall: result.overallScore,
          dimensions: result.dimensions,
          scoredAt: new Date().toISOString(),
        },
        scores: result.rawScore as any,
        optimizationExecutionId: executionId,
      },
    })

    return {
      id: snapshot.id,
      score: result.overallScore,
      dimensions: result.dimensions,
    }
  }

  async getSnapshot(snapshotId: string): Promise<{ id: string; score: number; dimensions: any; scores: any } | null> {
    const snapshot = await this.prisma.gEOScoreSnapshot.findUnique({ where: { id: snapshotId } })
    if (!snapshot) return null
    return {
      id: snapshot.id,
      score: (snapshot.snapshot as any)?.overall || 0,
      dimensions: (snapshot.snapshot as any)?.dimensions || {},
      scores: snapshot.scores,
    }
  }
}
