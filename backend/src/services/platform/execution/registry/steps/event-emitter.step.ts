// ============================================================
// Event Emitter Step Plugin — emits platform events
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'
import type { IEventBus } from '@platform/events/event-bus'
import { platformEventBus } from '@platform/events/event-bus'

export function createEventEmitterStep(eventBus?: IEventBus): StepPlugin {
  const bus = eventBus || platformEventBus

  return {
    name: 'event-emitter',
    type: 'step',
    stepType: StepType.EMIT_EVENT,

    async execute(input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()
      const { step, executionContext } = input

      try {
        const storedAssetId = step.inputs?.storedAssetId || 'unknown'

        bus.emit({
          type: 'execution:Completed',
          source: 'execution-runtime',
          timestamp: new Date().toISOString(),
          context: executionContext.context,
          traceId: executionContext.context?.traceId,
          entityId: storedAssetId,
          projectId: executionContext.context?.projectId,
          payload: {
            planId: executionContext.planId,
            capabilityId: executionContext.capabilityId,
            storedAssetId,
            stepId: step.id,
          },
        })

        return {
          success: true,
          output: { emitted: true, eventType: 'execution:Completed' },
          durationMs: Date.now() - startTime,
        }
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'EVENT_EMIT_ERROR',
            message: (err as Error).message,
          },
          durationMs: Date.now() - startTime,
        }
      }
    },
  }
}
