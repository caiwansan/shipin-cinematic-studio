// ============================================================
// Prompt Builder Step Plugin — builds prompt for provider calls
// Interface only — concrete implementations can be registered.
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'

export function createPromptBuilderStep(): StepPlugin {
  return {
    name: 'prompt-builder',
    type: 'step',
    stepType: StepType.BUILD_PROMPT,

    async execute(input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()
      const { step, intermediateResults } = input

      try {
        // Resolve context from intermediate results
        const contextKey = `${step.id}.prompt`
        const executionContext = intermediateResults.get('executionContext') || {}

        // Build prompt from available context
        const prompt = {
          system: `Execute capability: ${executionContext.capabilityName || 'unknown'}`,
          user: JSON.stringify(executionContext),
          context: executionContext,
          builtAt: new Date().toISOString(),
        }

        intermediateResults.set(contextKey, prompt)
        intermediateResults.set(step.id, prompt)

        return {
          success: true,
          output: prompt,
          durationMs: Date.now() - startTime,
        }
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'PROMPT_BUILD_ERROR',
            message: (err as Error).message,
          },
          durationMs: Date.now() - startTime,
        }
      }
    },
  }
}
