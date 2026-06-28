// ============================================================
// Human Approval Step — human-in-the-loop approval
// KMKI-KERNEL-001: New step type for human-in-the-loop workflows
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'
import { PlatformContext } from '@platform/context/platform-context'

/**
 * Create a Human Approval step plugin.
 * Registered for StepType.CALL_HUMAN.
 * Interface only — no default implementation.
 */
export function createHumanApprovalStep(): StepPlugin {
  return {
    name: 'human-approval',
    type: 'step',
    stepType: StepType.CALL_HUMAN,
    async execute(input: StepPluginInput, _ctx?: PlatformContext): Promise<StepPluginOutput> {
      throw new Error('CALL_HUMAN step plugin not implemented: Human Approval Service required')
    },
  }
}
