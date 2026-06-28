/**
 * Executor Registry — bridges Graph Runtime v1 executors with new LLM Executors
 *
 * When the Graph Runtime calls executeStep, it uses the old registry
 * (graph-runtime/runtime/node.executor.ts).
 * This file provides a bridge that routes known node types to real LLM executors.
 */

import { getExecutor, registerExecutor } from '../../graph-runtime/runtime/node.executor.js'
import { ExecutionContext } from '../../graph-runtime/runtime/context.js'
import type { ExecutionStep } from '../../graph-runtime/compiler/graph.compiler.js'

import { PromptBuilderExecutor } from './prompt-builder.executor.js'
import { ScriptWriterExecutor } from './script-writer.executor.js'
import { StoryboardExecutor } from './storyboard.executor.js'
import { ShotSplitExecutor } from './shot-split.executor.js'
import { ImagePromptExecutor } from './image-prompt.executor.js'
import { ImageGenExecutor } from './image-gen.executor.js'

// ============================================================
// Auto-register all real executors
// ============================================================

export function registerRealExecutors(): void {
  const executors = [
    new PromptBuilderExecutor(),
    new ScriptWriterExecutor(),
    new StoryboardExecutor(),
    new ShotSplitExecutor(),
    new ImagePromptExecutor(),
    new ImageGenExecutor(),
  ]

  for (const executor of executors) {
    registerExecutor(executor.type, {
      async execute(step: ExecutionStep, ctx: ExecutionContext, signal?: AbortSignal) {
        const result = await executor.execute({
          nodeId: step.nodeId,
          nodeType: step.nodeType,
          config: {},
          inputs: resolveInputs(step, ctx),
          ctx,
          signal,
        })

        if (!result.success) {
          return {
            _status: 'failed',
            _error: result.error,
            _nodeId: step.nodeId,
            _type: step.nodeType,
          }
        }

        return {
          _status: 'success',
          _nodeId: step.nodeId,
          _type: step.nodeType,
          ...result.outputs,
          _tokensUsed: result.metadata?.tokensUsed,
          _durationMs: result.metadata?.durationMs,
          _model: result.metadata?.model,
          _provider: result.metadata?.provider,
        }
      },
    })

    console.log(`[executors] registered real executor: ${executor.type}`)
  }
}

function resolveInputs(step: ExecutionStep, ctx: ExecutionContext): Record<string, any> {
  const inputs: Record<string, any> = {}
  for (const input of step.inputs) {
    inputs[input.port] = ctx.resolveInput(input)
  }
  return inputs
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

