// ============================================================
// Run Script Step — executes a script
// KMKI-KERNEL-001: New step type for script execution
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'
import { PlatformContext } from '@platform/context/platform-context'

/**
 * Create a Run Script step plugin.
 * Registered for StepType.RUN_SCRIPT.
 * Interface only — no default implementation.
 */
export function createRunScriptStep(): StepPlugin {
  return {
    name: 'run-script',
    type: 'step',
    stepType: StepType.RUN_SCRIPT,
    async execute(input: StepPluginInput, _ctx?: PlatformContext): Promise<StepPluginOutput> {
      throw new Error('RUN_SCRIPT step plugin not implemented: Script Runner required')
    },
  }
}
