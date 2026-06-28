/**
 * Graph Runtime v1 — Node Registry
 *
 * Maps node types to their actual executors.
 * This is the extension point for adding new node capabilities.
 *
 * IMPORTANT: All executors must NOT throw exceptions. They should return
 * { _status: 'failed', _error: string } instead. The runtime's catch
 * handler is only the last line of defense — executors should self-fail.
 */

import { registerExecutor, type NodeExecutor } from '../runtime/node.executor.js'
import { narrativeGateway } from '../../runtime/narrative-gateway.js'
import { enqueueTask } from '../../queue/queue-manager.js'

// ============================================================
// Built-in Executors
// ============================================================

const storyboardExecutor: NodeExecutor = {
  async execute(step, ctx, signal) {
    try {
      const inputs = await resolveInputs(step, ctx)
      const storyData = inputs['storyData'] || inputs['text'] || ''
      const systemPrompt = '你是一位资深分镜师。根据故事内容生成分镜方案，返回 JSON: { storyboards: [{ scene: string, shots: number, description: string }] }'
      const result = await narrativeGateway.execute({
        systemPrompt,
        userMessage: String(storyData).slice(0, 6000),
        timeoutTier: 'normal',
        userId: 'graph-runtime',
      })
      const parsed = JSON.parse(result.content)
      return {
        _status: 'success',
        _nodeId: step.nodeId,
        _type: 'storyboard',
        frames: parsed.storyboards || [],
        segments: parsed.storyboards || [],
        ok: result.ok,
        degraded: result.degraded,
        ...inputs,
      }
    } catch (err: any) {
      return {
        _status: 'failed',
        _nodeId: step.nodeId,
        _type: 'storyboard',
        _error: err.message,
        frames: [],
        segments: [],
      }
    }
  },
}

const videoGenExecutor: NodeExecutor = {
  async execute(step, ctx, signal) {
    try {
      const inputs = await resolveInputs(step, ctx)
      const frames = inputs['frames'] || inputs['storyboards'] || []
      const scenes = inputs['scenes'] || []
      const traceId = await enqueueTask({
        taskType: 'video',
        projectId: 'graph-runtime',
        userId: 'graph-runtime',
        input: { frames, scenes, ...inputs },
        priority: 5,
      })
      return {
        _status: 'success',
        _nodeId: step.nodeId,
        _type: 'video_gen',
        jobId: traceId,
        video: [],
        ...inputs,
      }
    } catch (err: any) {
      return {
        _status: 'failed',
        _nodeId: step.nodeId,
        _type: 'video_gen',
        _error: err.message,
        video: [],
      }
    }
  },
}

const llmExecutor: NodeExecutor = {
  async execute(step, ctx, signal) {
    try {
      const inputs = await resolveInputs(step, ctx)
      const prompt = inputs['prompt'] || inputs['text'] || ''
      const systemMsg = inputs['systemPrompt'] || '请根据输入生成内容'
      const result = await narrativeGateway.execute({
        systemPrompt: systemMsg,
        userMessage: String(prompt),
        timeoutTier: 'normal',
        userId: 'graph-runtime',
      })
      return {
        _status: 'success',
        _nodeId: step.nodeId,
        _type: 'llm',
        text: result.content,
        ok: result.ok,
        degraded: result.degraded,
        jobId: result.jobId,
        ...inputs,
      }
    } catch (err: any) {
      return {
        _status: 'failed',
        _nodeId: step.nodeId,
        _type: 'llm',
        _error: err.message,
        text: '',
      }
    }
  },
}

const conditionalExecutor: NodeExecutor = {
  async execute(step, ctx, signal) {
    try {
      const inputs = await resolveInputs(step, ctx)
      const conditionValue = inputs['condition']
      const value = inputs['value']
      const result = conditionValue ? value : null
      return {
        _status: 'success',
        _nodeId: step.nodeId,
        true: result,
        false: !conditionValue ? value : null,
      }
    } catch (err: any) {
      return {
        _status: 'failed',
        _nodeId: step.nodeId,
        _error: err.message,
        true: null,
        false: null,
      }
    }
  },
}

async function resolveInputs(step: any, ctx: any): Promise<Record<string, any>> {
  const inputs: Record<string, any> = {}
  for (const input of step.inputs) {
    inputs[input.port] = ctx.resolveInput(input)
  }
  return inputs
}

// ============================================================
// Register Built-in Executors
// ============================================================

export function registerBuiltinExecutors(): void {
  registerExecutor('storyboard', storyboardExecutor)
  registerExecutor('video_gen', videoGenExecutor)
  registerExecutor('llm', llmExecutor)
  registerExecutor('conditional', conditionalExecutor)
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

