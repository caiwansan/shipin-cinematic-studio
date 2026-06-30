import { PrismaClient } from '@prisma/client'
import { LearningEngine } from './learning-engine'
import type { RecommendationSignal, LearningExplain } from './learning.types'

export class LearningService {
  private engine: LearningEngine

  constructor(prisma: PrismaClient, engine?: LearningEngine) {
    this.engine = engine || new LearningEngine(prisma)
  }

  async learn(projectId: string) {
    return this.engine.learn(projectId)
  }

  async getRecommendationSignals(projectId: string): Promise<RecommendationSignal[]> {
    return this.engine.getRecommendationSignals(projectId)
  }

  async explain(signalId: string): Promise<LearningExplain | null> {
    return this.engine.explain(signalId)
  }

  async getHistory(projectId: string, limit = 20, offset = 0) {
    return this.engine.getHistory(projectId, limit, offset)
  }

  async getDashboard() {
    return this.engine.getDashboard()
  }
}
