// ============================================================
// Asset Saver Step Plugin — stores validated output as asset
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'

export function createAssetSaverStep(): StepPlugin {
  return {
    name: 'asset-saver',
    type: 'step',
    stepType: StepType.STORE_ASSET,

    async execute(input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()
      const { step, intermediateResults } = input

      try {
        // Resolve validated output from intermediate results
        const validatedOutput = intermediateResults.get('validatedOutput')

        if (!validatedOutput) {
          return {
            success: false,
            error: {
              code: 'SAVE_NO_INPUT',
              message: 'No validated output to store',
            },
            durationMs: Date.now() - startTime,
          }
        }

        // TODO: Implement actual asset storage via Asset Runtime
        const storedAsset = {
          id: `asset-${Date.now().toString(36)}`,
          type: 'execution_output',
          content: validatedOutput,
          storedAt: new Date().toISOString(),
        }

        intermediateResults.set(`${step.id}.storedAsset`, storedAsset)
        intermediateResults.set(step.id, storedAsset)

        return {
          success: true,
          output: { storedAssetId: storedAsset.id },
          durationMs: Date.now() - startTime,
        }
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'ASSET_SAVE_ERROR',
            message: (err as Error).message,
          },
          durationMs: Date.now() - startTime,
        }
      }
    },
  }
}
