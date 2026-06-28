// ============================================================
// Semantic Loader Step Plugin — loads semantic context
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'

export function createSemanticLoaderStep(): StepPlugin {
  return {
    name: 'semantic-loader',
    type: 'step',
    stepType: StepType.LOAD_SEMANTIC,

    async execute(input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()
      const { step, intermediateResults } = input

      try {
        // TODO: Implement actual semantic loading from Semantic Runtime
        const semanticContext = {
          entities: [],
          topics: [],
          confidence: 0,
          loadedAt: new Date().toISOString(),
        }

        intermediateResults.set(`${step.id}.semanticContext`, semanticContext)
        intermediateResults.set(step.id, semanticContext)

        return {
          success: true,
          output: semanticContext,
          durationMs: Date.now() - startTime,
        }
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'SEMANTIC_LOAD_ERROR',
            message: (err as Error).message,
          },
          durationMs: Date.now() - startTime,
        }
      }
    },
  }
}
