// ============================================================
// Tool Call Step — calls a business/system tool
// KMKI-KERNEL-001: New step type for generic tool execution
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'
import { PlatformContext } from '@platform/context/platform-context'

/**
 * Create a Tool Call step plugin.
 * Registered for StepType.CALL_TOOL.
 * Interface only — no default implementation.
 */
export function createToolCallStep(): StepPlugin {
  return {
    name: 'tool-call',
    type: 'step',
    stepType: StepType.CALL_TOOL,
    async execute(input: StepPluginInput, _ctx?: PlatformContext): Promise<StepPluginOutput> {
      throw new Error('CALL_TOOL step plugin not implemented: Tool Registry required')
    },
  }
}
