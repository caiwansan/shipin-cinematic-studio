/**
 * ShotSplitExecutor
 * Input: storyboard (json) → Output: shots (json)
 * Splits storyboard frames into individual shot descriptions with camera directions.
 */

import { BaseLLMExecutor } from './base-llm.executor.js'
import type { ExecutorInput } from './base.executor.js'

export class ShotSplitExecutor extends BaseLLMExecutor {
  type = 'shot_split'

  systemPrompt = `You are a shot composition specialist for AI video.
Given storyboard frames, split each into individual shots with precise camera directions.

Output JSON array:
[
  {
    "shot": 1,
    "scene": 1,
    "description": "visual description",
    "camera": {
      "angle": "low angle | eye level | high angle",
      "movement": "static | pan | zoom | dolly | tracking",
      "framing": "close-up | medium | wide | extreme wide"
    },
    "duration_seconds": 5,
    "dialogue": ""
  }
]

Output ONLY valid JSON.`

  protected buildUserMessage(input: ExecutorInput): string {
    const frames = input.inputs.frames ?? input.inputs.storyboard ?? input.inputs.default ?? []
    return `Split these storyboard frames into individual shots with camera directions:

${typeof frames === 'string' ? frames : JSON.stringify(frames, null, 2)}

Output JSON array of shots:`
  }

  protected parseOutput(content: string): Record<string, any> {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim()
      const shots = JSON.parse(jsonStr)
      return { shots: Array.isArray(shots) ? shots : [shots] }
    } catch {
      return { shots: [{ shot: 1, description: content.trim(), camera: { angle: 'eye level', movement: 'static', framing: 'medium' }, duration_seconds: 5 }] }
    }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

