/**
 * Graph Runtime v1 — Node Schema registry
 *
 * Defines the input/output schema for every built-in node type.
 * This is what the Graph Validator uses to check type compatibility.
 */

import type { NodeIOSchema } from './graph.types.js'

// ============================================================
// Built-in Node IO Schemas
// ============================================================

const NODE_SCHEMAS: Record<string, NodeIOSchema> = {
  script_input: {
    inputs: {},
    outputs: {
      script: { type: 'script', description: 'Input script text' },
    },
    runtime: 'sync',
  },

  storyboard: {
    inputs: {
      script: { type: 'script', required: true, description: 'Source script' },
    },
    outputs: {
      frames: { type: 'json[]', description: 'Storyboard frames (scene/description/camera/dialogue)' },
      segments: { type: 'json[]', description: 'Shot segments with timing' },
    },
    runtime: 'async',
  },

  character_def: {
    inputs: {
      script: { type: 'script', required: true, description: 'Character context' },
    },
    outputs: {
      characters: { type: 'json[]', description: 'Character definitions' },
    },
    runtime: 'async',
  },

  scene_gen: {
    inputs: {
      frames: { type: 'image[]', required: false, description: 'Reference frames' },
      characters: { type: 'json[]', required: false, description: 'Character definitions' },
      prompt: { type: 'text', required: true, description: 'Scene description' },
    },
    outputs: {
      scenes: { type: 'image[]', description: 'Generated scene images' },
    },
    runtime: 'async',
  },

  voice_gen: {
    inputs: {
      script: { type: 'script', required: true, description: 'Dialogue text' },
      characters: { type: 'json[]', required: false, description: 'Voice character mapping' },
    },
    outputs: {
      audio: { type: 'audio[]', description: 'Generated voice clips' },
    },
    runtime: 'async',
  },

  video_gen: {
    inputs: {
      frames: { type: 'image[]', required: true, description: 'Source frames' },
      audio: { type: 'audio[]', required: false, description: 'Voiceover audio' },
    },
    outputs: {
      video: { type: 'video[]', description: 'Generated video segments' },
    },
    runtime: 'async',
  },

  effect: {
    inputs: {
      video: { type: 'video[]', required: true, description: 'Input video' },
      params: { type: 'json', required: false, description: 'Effect parameters' },
    },
    outputs: {
      video: { type: 'video[]', description: 'Effected video output' },
    },
    runtime: 'async',
  },

  render: {
    inputs: {
      video: { type: 'video[]', required: true, description: 'Final video segments' },
      audio: { type: 'audio[]', required: false, description: 'Final audio' },
    },
    outputs: {
      output: { type: 'video', description: 'Rendered output file' },
    },
    runtime: 'async',
  },

  output: {
    inputs: {
      output: { type: 'video', required: true, description: 'Output asset' },
    },
    outputs: {},
    runtime: 'sync',
  },

  conditional: {
    inputs: {
      condition: { type: 'json', required: true, description: 'Condition expression' },
      value: { type: 'any', required: true, description: 'Value to evaluate' },
    },
    outputs: {
      true: { type: 'any', description: 'Output when condition is true' },
      false: { type: 'any', description: 'Output when condition is false' },
    },
    runtime: 'sync',
  },

  parallel: {
    inputs: {
      inputs: { type: 'any[]', required: true, description: 'Array of inputs to fan-out' },
    },
    outputs: {
      outputs: { type: 'any[]', description: 'Array of parallel outputs' },
    },
    runtime: 'async',
  },

  merge: {
    inputs: {
      inputs: { type: 'any[]', required: true, description: 'Inputs to merge' },
    },
    outputs: {
      output: { type: 'any', description: 'Merged result' },
    },
    runtime: 'sync',
  },

  // ============================================================
  // LLM Executor Node Schemas
  // ============================================================

  prompt_builder: {
    inputs: {
      idea: { type: 'text', required: false, description: 'Raw idea / user input (optional)' },
    },
    outputs: {
      prompt: { type: 'text', description: 'Production-ready prompt' },
    },
    runtime: 'async',
  },

  script_writer: {
    inputs: {
      prompt: { type: 'text', required: true, description: 'Production prompt' },
    },
    outputs: {
      script: { type: 'script', description: 'Generated short drama script' },
    },
    runtime: 'async',
  },

  storyboard_with_llm: {
    inputs: {
      script: { type: 'script', required: true, description: 'Script to storyboard' },
    },
    outputs: {
      frames: { type: 'json[]', description: 'Storyboard frames JSON' },
    },
    runtime: 'async',
  },

  shot_split: {
    inputs: {
      frames: { type: 'json[]', required: true, description: 'Storyboard frames' },
    },
    outputs: {
      shots: { type: 'json[]', description: 'Shot breakdowns' },
    },
    runtime: 'async',
  },

  image_prompt: {
    inputs: {
      shots: { type: 'json[]', required: true, description: 'Shot breakdowns' },
    },
    outputs: {
      image_prompts: { type: 'json[]', description: 'Image generation prompts' },
    },
    runtime: 'async',
  },

  image_gen: {
    inputs: {
      image_prompts: { type: 'json[]', required: true, description: 'Image generation prompts' },
    },
    outputs: {
      images: { type: 'image[]', description: 'Generated images' },
    },
    runtime: 'async',
  },
}

// ============================================================
// Public API
// ============================================================

export function getNodeSchema(nodeType: string): NodeIOSchema | null {
  return NODE_SCHEMAS[nodeType] ?? null
}

export function registerNodeSchema(nodeType: string, schema: NodeIOSchema): void {
  NODE_SCHEMAS[nodeType] = schema
}

export function getAllNodeSchemas(): Record<string, NodeIOSchema> {
  return { ...NODE_SCHEMAS }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

