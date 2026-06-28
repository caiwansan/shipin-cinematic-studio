/**
 * Base LLM Executor — shared logic for all LLM-based nodes
 */

import type { IExecutor, ExecutorInput, ExecutorResult } from './base.executor.js'
import { getProviderForModel } from '../providers/provider.registry.js'
import type { LLMMessage } from '../providers/base.provider.js'

export abstract class BaseLLMExecutor implements IExecutor {
  abstract type: string
  abstract systemPrompt: string

  async execute(input: ExecutorInput): Promise<ExecutorResult> {
    const start = Date.now()
    const model = input.config.model ?? 'deepseek-chat'
    const provider = getProviderForModel(model)

    if (!provider) {
      return {
        success: false,
        outputs: {},
        error: `No provider found for model "${model}". Available: deepseek-chat, gpt-4o`,
        metadata: { durationMs: Date.now() - start },
      }
    }

    const userMessage = this.buildUserMessage(input)
    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userMessage },
    ]

    try {
      const response = await provider.call(
        { model, messages, temperature: input.config.temperature ?? 0.7 },
        input.signal,
      )

      const result = this.parseOutput(response.content, input)

      return {
        success: true,
        outputs: result,
        metadata: {
          durationMs: Date.now() - start,
          tokensUsed: response.usage.totalTokens,
          model: response.model,
          provider: provider.name,
        },
      }
    } catch (err: any) {
      return {
        success: false,
        outputs: {},
        error: `LLM execution failed: ${err.message}`,
        metadata: { durationMs: Date.now() - start },
      }
    }
  }

  protected abstract buildUserMessage(input: ExecutorInput): string
  protected abstract parseOutput(content: string, input: ExecutorInput): Record<string, any>
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

