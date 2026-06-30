import { PrismaClient } from '@prisma/client'
import { eventBus } from '../../../platform/event-bus'
import type { DomainEvent } from '../../../platform/event-bus/types'
import { LearningEngine } from './learning-engine'

export class LearningSubscriber {
  private engine: LearningEngine
  private subscribed = false

  constructor(prisma: PrismaClient) {
    this.engine = new LearningEngine(prisma)
  }

  subscribe(): void {
    if (this.subscribed) return

    // Monitor drift may trigger re-learning
    eventBus.subscribe('monitor.score_drift', async (event: DomainEvent) => {
      const { projectId } = event.payload
      try {
        await this.engine.learn(projectId)
      } catch (err: any) {
        console.error(`[LearningSubscriber] Learn failed after drift: ${err.message}`)
      }
    })

    // Publishing completion may trigger re-learning
    eventBus.subscribe('publishing.verified_online', async (event: DomainEvent) => {
      const { projectId } = event.payload
      try {
        await this.engine.learn(projectId)
      } catch (err: any) {
        console.error(`[LearningSubscriber] Learn failed after publish: ${err.message}`)
      }
    })

    this.subscribed = true
  }

  unsubscribe(): void {
    this.subscribed = false
  }
}
