// ⭐ 唯一事实源：所有别名/标准化规则集中于此
// normalizer.ts 自动从 FIELD_MAP 编译
// 禁止在 normalizer.ts 手写规则

export interface FieldMapEntry {
  canonical: string
  alias: string[]
  type: 'string' | 'number' | 'array' | 'object'
  coerce?: (v: any) => any
}

// ⭐ 字段级映射
export const FIELD_MAP: Record<string, FieldMapEntry> = {
  sceneId: {
    canonical: 'sceneKey',
    alias: ['sceneKey', 'sceneId', 'scene_id', 'sceneid'],
    type: 'string',
    coerce: (v: any) => String(v),
  },
  sceneOrder: {
    canonical: 'sceneOrder',
    alias: ['sceneOrder', 'scene_order', 'order'],
    type: 'number',
    coerce: (v: any) => Number(v),
  },
  characterName: {
    canonical: 'characterName',
    alias: ['characterName', 'character_name', 'name', 'charName'],
    type: 'string',
  },
  sceneName: {
    canonical: 'sceneName',
    alias: ['sceneName', 'scene_name', 'name'],
    type: 'string',
  },
  propSpecs: {
    canonical: 'propSpecs',
    alias: ['propSpecs', 'prop_specs', 'props', 'propSpec'],
    type: 'array',
  },
  characterVariants: {
    canonical: 'characterVariants',
    alias: ['characterVariants', 'charVariants', 'char_variants', 'character_variants'],
    type: 'object',
  },
  imagePrompt: {
    canonical: 'imagePrompt',
    alias: ['imagePrompt', 'image_prompt', 'imgPrompt', 'prompt'],
    type: 'string',
  },
  negativePrompt: {
    canonical: 'negativePrompt',
    alias: ['negativePrompt', 'negative_prompt', 'negPrompt'],
    type: 'string',
  },
}

// ⭐ 每个 Agent 的 schema 版本（用于 schemaVersioning）
export const AGENT_SCHEMA_VERSIONS: Record<string, string> = {
  'plot-supervisor': '1.0',
  'character-designer': '1.0',
  'scene-designer': '1.0',
  'sound-designer': '1.0',
  'frame-designer': '1.0',
  'props-designer': '1.0',
  'director-of-photography': '1.0',
  'makeup-designer': '1.0',
  'action-optimizer': '1.0',
  'video-prompt-optimizer': '1.0',
}

// ⭐ Agent 级别 JSON schema
export interface SchemaNode {
  type: 'string' | 'number' | 'array' | 'object' | 'any'
  required?: boolean
  default?: any
  oneOf?: string[]
  itemSchema?: Record<string, SchemaNode>
  fields?: Record<string, SchemaNode>
}

export const AGENT_SCHEMAS: Record<string, SchemaNode> = {
  plot: {
    type: 'object',
    fields: {
      title: { type: 'string', required: true },
      stateEvolution: { type: 'string', required: false },
      characters: {
        type: 'array', required: true,
        itemSchema: {
          characterName: { type: 'string', required: true },
          variant: { type: 'string', required: true },
          role: { type: 'string', required: false },
        },
      },
      scenes: {
        type: 'array', required: true,
        itemSchema: {
          sceneKey: { type: 'string', required: true },
          name: { type: 'string', required: true },
          env: { type: 'string', required: false },
          time: { type: 'string', required: false },
          weather: { type: 'string', required: false },
          summary: { type: 'string', required: true },
          script: { type: 'string', required: true },
          characterVariants: { type: 'object', required: false },
        },
      },
    },
  },

  character: {
    type: 'array', required: true,
    itemSchema: {
      characterName: { type: 'string', required: true },
      variant: { type: 'string', required: true },
      gender: { type: 'string', required: false },
      age: { type: 'string', required: false },
      physicalDescription: { type: 'string', required: true },
      clothing: { type: 'string', required: false },
      imagePrompt: { type: 'string', required: true },
      negativePrompt: { type: 'string', required: false },
      styleEra: { type: 'string', required: false },
    },
  },

  scene: {
    type: 'array', required: true,
    itemSchema: {
      sceneKey: { type: 'string', required: true },
      sceneName: { type: 'string', required: true },
      description: { type: 'string', required: true },
      imagePrompt: { type: 'string', required: true },
      aspectRatio: { type: 'string', required: true },
    },
  },

  voice: {
    type: 'array', required: true,
    itemSchema: {
      characterName: { type: 'string', required: true },
      voiceType: {
        type: 'string', required: true,
        oneOf: [
          'zh_female_sweet', 'zh_male_deep', 'zh_female_gentle', 'zh_male_cheerful',
          'zh_male_warm', 'zh_female_mature', 'zh_male_young', 'zh_female_young',
          'zh_male_authoritative', 'zh_female_elegant',
        ],
      },
      speakingStyle: { type: 'string', required: false },
      pitch: { type: 'number', required: true },
      speed: { type: 'number', required: true },
    },
  },

  frame: {
    type: 'object', required: true,
    fields: {
      videoSegments: {
        type: 'array', required: true,
        itemSchema: {
          segmentId: { type: 'string', required: true },
          title: { type: 'string', required: false },
          narrativePurpose: { type: 'string', required: true },
          duration: { type: 'number', required: true },
          shotPattern: { type: 'string', required: false },
          emotionArc: { type: 'string', required: false },
        },
      },
      frameDesigns: {
        type: 'array', required: false,
        itemSchema: {
          segmentId: { type: 'string', required: true },
          firstFrame: {
            type: 'object', required: true,
            fields: {
              description: { type: 'string', required: true },
              imagePrompt: { type: 'string', required: true },
            },
          },
          lastFrame: {
            type: 'object', required: true,
            fields: {
              description: { type: 'string', required: true },
              imagePrompt: { type: 'string', required: true },
            },
          },
        },
      },
      videoProduction: { type: 'object', required: false },
    },
  },

  prop: {
    type: 'array', required: true,
    itemSchema: {
      propName: { type: 'string', required: true },
      category: { type: 'string', required: false },
      material: { type: 'string', required: false },
      color: { type: 'string', required: false },
      sceneAffiliation: { type: 'string', required: false },
      imagePrompt: { type: 'string', required: true },
    },
  },
}
