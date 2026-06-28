// ============================================================
// Wait Event Step — waits for an external event
// KMKI-KERNEL-001: New step type for event-driven wait
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'
import { PlatformContext } from '@platform/context/platform-context'

/**
 * Create a Wait Event step plugin.
 * Registered for StepType.WAIT_EVENT.
 * Interface only — no default implementation.
 */
export function createWaitEventStep(): StepPlugin {
  return {
    name: 'wait-event',
    type: 'step',
    stepType: StepType.WAIT_EVENT,
    async execute(input: StepPluginInput, _ctx?: PlatformContext): Promise<StepPluginOutput> {
      throw new Error('WAIT_EVENT step plugin not implemented: Event Listener required')
    },
  }
}
