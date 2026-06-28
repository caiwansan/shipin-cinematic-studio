// ============================================================
// Provider Call Step Plugin — interface only
// Implements the REASON step type (provider-agnostic).
// Actual provider dispatch deferred to Provider Runtime phase.
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'

/**
 * Provider Call Step Plugin (REASON step type).
 * 
 * IMPORTANT: This is a PLACEHOLDER interface only.
 * Actual provider implementation is in the NEXT phase (KMKI-PLAT-008 Provider Runtime).
 * 
 * To implement provider calls, register a new StepPlugin with stepType=StepType.REASON:
 * 
 * ```typescript
 * stepPluginRegistry.register({
 *   name: 'my-provider-reason',
 *   type: 'step',
 *   stepType: StepType.REASON,
 *   async execute(input, ctx) {
 *     // Implement actual provider call here
 *   },
 * })
 * ```
 */
export function createProviderCallStep(): StepPlugin {
  return {
    name: 'provider-reason',
    type: 'step',
    stepType: StepType.REASON,

    async execute(_input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()

      return {
        success: false,
        error: {
          code: 'PROVIDER_NOT_IMPLEMENTED',
          message: 'REASON step plugin is not implemented yet. This will be available in the Provider Runtime phase (KMKI-PLAT-008).',
        },
        durationMs: Date.now() - startTime,
      }
    },
  }
}
