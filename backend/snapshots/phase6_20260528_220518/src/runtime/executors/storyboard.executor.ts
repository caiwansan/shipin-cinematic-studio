/**
 * StoryboardExecutor
 * Input: script (text) → Output: storyboard (json)
 * Breaks a script into scene-by-scene storyboard frames.
 */

import { BaseLLMExecutor } from './base-llm.executor.js'
import type { ExecutorInput } from './base.executor.js'

export class StoryboardExecutor extends BaseLLMExecutor {
  type = 'storyboard'

  systemPrompt = `You are a professional storyboard artist for AI video production.
Given a script, output a JSON array of storyboard frames.

Each frame has:
- scene: scene number
- description: visual description
- camera: camera angle/movement
- dialogue: any spoken lines
- duration: estimated seconds
- visual_style: art style guidance

Output ONLY valid JSON, no commentary.`

  protected buildUserMessage(input: ExecutorInput): string {
    return `Create a storyboard JSON from this script:

${input.inputs.script ?? input.inputs.text ?? input.inputs.default ?? 'No input'}

Output a JSON array of storyboard frames:`
  }

  protected parseOutput(content: string): Record<string, any> {
    try {
      // Extract JSON from response (handles ```json blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim()
      const frames = JSON.parse(jsonStr)
      return {
        frames: Array.isArray(frames) ? frames : [frames],
        raw: content,
      }
    } catch {
      // If JSON parsing fails, return raw text as a single frame
      return {
        frames: [{ scene: 1, description: content.trim(), camera: 'medium', dialogue: '', duration: 10 }],
        raw: content,
      }
    }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

