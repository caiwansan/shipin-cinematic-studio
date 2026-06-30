import { PrismaClient } from '@prisma/client'
import { eventBus } from '../../../platform/event-bus'
import { PublishingPipelineService } from './publishing-pipeline.service'

export class PublishingSubscriber {
  private pipeline: PublishingPipelineService
  private subscribed = false

  constructor(prisma: PrismaClient) {
    this.pipeline = new PublishingPipelineService(prisma)
  }

  /**
   * Subscribe to verification events.
   * When verification completes successfully, automatically initiate publishing.
   */
  subscribe(): void {
    if (this.subscribed) return

    eventBus.subscribe('verification.completed', async (event) => {
      const { executionId, projectId, delta, isImprovement } = event.payload

      if (!isImprovement) {
        return // Skip — no improvement to publish
      }

      // Auto-submit publishing for website platform
      try {
        const result = await this.pipeline.submit({
          projectId,
          executionId,
          platform: 'website',
          contentType: 'knowledge',
          content: {
            verifiedAt: new Date().toISOString(),
            delta,
            executionId,
          },
          afterContent: { verifiedDelta: delta, verifiedAt: new Date().toISOString() },
        })
        console.log(`[PublishingSubscriber] Auto-created draft: ${result.publishId}`)
      } catch (err: any) {
        console.error(`[PublishingSubscriber] Failed to auto-publish: ${err.message}`)
      }
    })

    this.subscribed = true
  }

  unsubscribe(): void {
    this.subscribed = false
  }
}
