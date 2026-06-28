// ============================================================
// Asset Loader Step Plugin — loads assets for execution
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'

export function createAssetLoaderStep(): StepPlugin {
  return {
    name: 'asset-loader',
    type: 'step',
    stepType: StepType.LOAD_ASSET,

    async execute(input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()
      const { step, intermediateResults } = input
      const capabilityId = step.inputs?.capabilityId

      try {
        // TODO: Implement actual asset loading from Asset Runtime
        // This is a placeholder that returns a mock result
        const loadedAssets = {
          capabilityId,
          assets: [],
          loadedAt: new Date().toISOString(),
        }

        intermediateResults.set(`${step.id}.assets`, loadedAssets)
        intermediateResults.set(step.id, loadedAssets)

        return {
          success: true,
          output: loadedAssets,
          durationMs: Date.now() - startTime,
        }
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'ASSET_LOAD_ERROR',
            message: (err as Error).message,
          },
          durationMs: Date.now() - startTime,
        }
      }
    },
  }
}
