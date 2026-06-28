/**
 * ImagePromptExecutor
 * Input: shots (json) → Output: image_prompts (json)
 * Converts shot descriptions into detailed image generation prompts.
 */

import { BaseLLMExecutor } from './base-llm.executor.js'
import type { ExecutorInput } from './base.executor.js'

export class ImagePromptExecutor extends BaseLLMExecutor {
  type = 'image_prompt'

  systemPrompt = `You are an expert AI image prompt engineer.
Given shot descriptions, generate detailed image generation prompts optimized for Stable Diffusion / DALL-E / Midjourney.

Each prompt includes:
- Subject, setting, lighting, color palette
- Camera angle and framing
- Art style (cinematic, anime, photorealistic, etc.)
- Quality keywords (4K, highly detailed, etc.)

Output JSON array:
[
  {
    "shot": 1,
    "prompt": "detailed image prompt...",
    "negative_prompt": "things to avoid...",
    "style": "cinematic | anime | realistic",
    "aspect_ratio": "16:9 | 9:16 | 1:1"
  }
]

Output ONLY valid JSON.`

  protected buildUserMessage(input: ExecutorInput): string {
    const shots = input.inputs.shots ?? input.inputs.default ?? []
    return `Generate image prompts for these shots:

${typeof shots === 'string' ? shots : JSON.stringify(shots, null, 2)}

Default style: ${input.config.style ?? 'cinematic'}
Default aspect ratio: ${input.config.aspectRatio ?? '16:9'}

Output JSON array of image prompts:`
  }

  protected parseOutput(content: string): Record<string, any> {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim()
      const prompts = JSON.parse(jsonStr)
      return { image_prompts: Array.isArray(prompts) ? prompts : [prompts] }
    } catch {
      return { image_prompts: [{ shot: 1, prompt: content.trim(), negative_prompt: '', style: 'cinematic', aspect_ratio: '16:9' }] }
    }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

