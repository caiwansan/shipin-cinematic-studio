// ============================================================
// MCP Call Step — calls a Model Context Protocol server
// KMKI-KERNEL-001: New step type for MCP-based tool execution
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'
import { PlatformContext } from '@platform/context/platform-context'

/**
 * Create an MCP Call step plugin.
 * Registered for StepType.CALL_MCP.
 * Interface only — no default implementation.
 */
export function createMcpCallStep(): StepPlugin {
  return {
    name: 'mcp-call',
    type: 'step',
    stepType: StepType.CALL_MCP,
    async execute(input: StepPluginInput, _ctx?: PlatformContext): Promise<StepPluginOutput> {
      throw new Error('CALL_MCP step plugin not implemented: MCP Server Registry required')
    },
  }
}
