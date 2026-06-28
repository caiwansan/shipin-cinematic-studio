// ============================================================
// Prompt Builder Step Plugin — builds context for reasoning steps
// Replaces BUILD_PROMPT with TRANSFORM category
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'

export function createPromptBuilderStep(): StepPlugin {
  return {
    name: 'prompt-builder',
    type: 'step',
    stepType: StepType.TRANSFORM,

    async execute(input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()
      const { step, intermediateResults } = input

      try {
        const contextKey = `${step.id}.context`
        const executionContext = intermediateResults.get('executionContext') || {}

        const context = {
          system: `Execute capability: ${executionContext.capabilityName || 'unknown'}`,
          user: JSON.stringify(executionContext),
          context: executionContext,
          builtAt: new Date().toISOString(),
        }

        intermediateResults.set(contextKey, context)
        intermediateResults.set(step.id, context)

        return {
          success: true,
          output: context,
          durationMs: Date.now() - startTime,
        }
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'CONTEXT_BUILD_ERROR',
            message: (err as Error).message,
          },
          durationMs: Date.now() - startTime,
        }
      }
    },
  }
}
