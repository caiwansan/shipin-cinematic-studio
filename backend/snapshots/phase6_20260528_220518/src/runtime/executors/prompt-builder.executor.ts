/**
 * PromptBuilderExecutor
 * Input: idea (text) → Output: prompt (text)
 * Takes a raw idea and expands it into a detailed production brief.
 */

import { BaseLLMExecutor } from './base-llm.executor.js'
import type { ExecutorInput } from './base.executor.js'

export class PromptBuilderExecutor extends BaseLLMExecutor {
  type = 'prompt_builder'

  systemPrompt = `You are a professional AI video production prompt engineer.
Your task: take a raw creative idea and expand it into a detailed, structured production prompt.

The prompt must include:
1. Core concept (one sentence)
2. Visual style (cinematic, anime, realistic, etc.)
3. Tone and mood
4. Key visual elements
5. Duration estimate

Output ONLY the expanded prompt text, no commentary.`

  protected buildUserMessage(input: ExecutorInput): string {
    return `Expand this creative idea into a detailed AI video production prompt:

Idea: ${input.inputs.idea ?? input.inputs.text ?? input.inputs.default ?? 'No input provided'}

Additional context: ${JSON.stringify(input.config?.context ?? {})}

Write a comprehensive production prompt:`
  }

  protected parseOutput(content: string): Record<string, any> {
    return { prompt: content.trim() }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

