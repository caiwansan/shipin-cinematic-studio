// ============================================================
// Step Plugin Registry — Plugin-based step executor registration
// All step execution dispatch goes through here; no switch/case.
// ============================================================

import { PluginRegistry, type Plugin } from '@platform/plugins/plugin-registry'
import type { ExecutionStep, ExecutionContext } from '../types.js'
import { StepType } from '../types.js'
import { PlatformContext } from '@platform/context/platform-context'

/**
 * Step Plugin interface — extends base Plugin with step-specific metadata.
 */
export interface StepPlugin extends Plugin<StepPluginOutput> {
  type: 'step'
  stepType: StepType
  execute(input: StepPluginInput, ctx?: PlatformContext): Promise<StepPluginOutput>
}

export interface StepPluginInput {
  step: ExecutionStep
  executionContext: ExecutionContext
  intermediateResults: Map<string, any>
  signal?: AbortSignal
}

export interface StepPluginOutput {
  success: boolean
  output?: any
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  durationMs?: number
}

/**
 * Step Plugin Registry — singleton registry for step plugins.
 */
export const stepPluginRegistry = new PluginRegistry<StepPlugin>()

/**
 * Register all default step plugins.
 */
export async function registerDefaultStepPlugins(): Promise<void> {
  const { createAssetLoaderStep } = await import('./steps/asset-loader.step.js')
  const { createSemanticLoaderStep } = await import('./steps/semantic-loader.step.js')
  const { createPromptBuilderStep } = await import('./steps/prompt-builder.step.js')
  const { createEventEmitterStep } = await import('./steps/event-emitter.step.js')
  const { createValidatorOutputStep } = await import('./steps/validator-ouput.step.js')
  const { createAssetSaverStep } = await import('./steps/asset-saver.step.js')

  stepPluginRegistry.register(createAssetLoaderStep())
  stepPluginRegistry.register(createSemanticLoaderStep())
  stepPluginRegistry.register(createPromptBuilderStep())
  stepPluginRegistry.register(createEventEmitterStep())
  stepPluginRegistry.register(createValidatorOutputStep())
  stepPluginRegistry.register(createAssetSaverStep())

  // Provider call is a plugin interface only — no default implementation
}

/**
 * Resolve a step executor for a given step type.
 * Throws if no plugin is registered for the step type.
 */
export function resolveStepExecutor(stepType: StepType): StepPlugin {
  const plugin = stepPluginRegistry.discover('step').find((p: StepPlugin) => p.stepType === stepType)
  if (!plugin) {
    throw new Error(`No step plugin registered for type: ${stepType}`)
  }
  return plugin
}

/**
 * Get all registered step executors.
 */
export function getRegisteredStepExecutors(): StepPlugin[] {
  return stepPluginRegistry.discover('step')
}
