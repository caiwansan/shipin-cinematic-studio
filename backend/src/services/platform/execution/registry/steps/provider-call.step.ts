// ============================================================
// Provider Call Step Plugin — interface only
// Implementation deferred to Provider Runtime phase.
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'

/**
 * Provider Call Step Plugin.
 * 
 * IMPORTANT: This is a PLACEHOLDER interface only.
 * Actual provider implementation is in the NEXT phase (Provider Runtime).
 * 
 * To implement provider calls, register a new StepPlugin with stepType=StepType.CALL_PROVIDER:
 * 
 * ```typescript
 * stepPluginRegistry.register({
 *   name: 'my-provider-call',
 *   type: 'step',
 *   stepType: StepType.CALL_PROVIDER,
 *   async execute(input, ctx) {
 *     // Implement actual provider call here
 *   },
 * })
 * ```
 */
export function createProviderCallStep(): StepPlugin {
  return {
    name: 'provider-call',
    type: 'step',
    stepType: StepType.CALL_PROVIDER,

    async execute(_input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()

      return {
        success: false,
        error: {
          code: 'PROVIDER_NOT_IMPLEMENTED',
          message: 'Provider call step is not implemented yet. This will be available in the Provider Runtime phase.',
        },
        durationMs: Date.now() - startTime,
      }
    },
  }
}
