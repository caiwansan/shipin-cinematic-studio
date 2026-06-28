/**
 * ScriptWriterExecutor
 * Input: prompt (text) → Output: script (text)
 * Generates a full narrative script from a production prompt.
 */

import { BaseLLMExecutor } from './base-llm.executor.js'
import type { ExecutorInput } from './base.executor.js'

export class ScriptWriterExecutor extends BaseLLMExecutor {
  type = 'script_writer'

  systemPrompt = `You are a professional screenwriter for AI-generated video content.
Given a production prompt, write a complete short-form video script (30-60 seconds).

Format:
\`\`\`
TITLE: [title]

SCENE 1: [description]
[Character]: [dialogue]

SCENE 2: [description]
[Narrator]: [narration]
\`\`\`

Rules:
- 3-5 scenes
- Short punchy dialogue
- Visual descriptions in [brackets]
- Keep total runtime under 60 seconds
- Include narrator voice if needed`

  protected buildUserMessage(input: ExecutorInput): string {
    return `Write a short-form video script based on this production prompt:

${input.inputs.prompt ?? input.inputs.text ?? input.inputs.default ?? 'No input'}

Tone: ${input.config.tone ?? 'cinematic'}
Duration: ${input.config.duration ?? '30-60 seconds'}
Genre: ${input.config.genre ?? 'drama'}

Write the script:`
  }

  protected parseOutput(content: string): Record<string, any> {
    return { script: content.trim() }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

