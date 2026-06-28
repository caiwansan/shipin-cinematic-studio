/**
 * Director Brain Agent
 * 
 * 最高优先级的导演智能体：
 * - 理解剧本主题和核心冲突
 * - 提取导演意图和叙事策略
 * - 分析情绪推进和情感曲线
 * - 判断镜头节奏和节奏模式
 * - 决定整体视觉风格
 * 
 * 输出规范化的"导演理解"供下游 Agent 使用
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

// ============================================================
// Director Understanding — 导演理解输出
// ============================================================

export interface DirectorUnderstanding {
  theme: string
  coreConflict: string
  genre: string
  overallTone: string
  emotionCurve: EmotionBeat[]
  visualStyle: VisualStyle
  cinematicLanguage: CinematicLanguage[]
  pacing: PacingType
  targetAudience: string
  keyScenes: KeyScene[]
}

export interface EmotionBeat {
  beat: string
  emotion: string
  intensity: number  // 1-10
  duration: 'short' | 'medium' | 'long'
}

export interface VisualStyle {
  colorPalette: string
  lighting: string
  cameraWork: string
  compositionStyle: string
  referenceStyle: string
}

export interface CinematicLanguage {
  element: string
  description: string
  reasoning: string
}

export type PacingType = 'slow_burn' | 'steady' | 'fast_paced' | 'dynamic' | 'episodic'

export interface KeyScene {
  id: string
  name: string
  purpose: string
  emotionalImpact: number
  isClimax: boolean
}

const SYSTEM_PROMPT = `你是一位资深电影导演和剧本分析师。你的工作是深度理解剧本，提取导演层面的创作意图。

请分析以下剧本并输出 JSON 格式的导演理解报告：

{
  "theme": "故事主题（一句话概括）",
  "coreConflict": "核心冲突",
  "genre": "类型",
  "overallTone": "整体基调",
  "emotionCurve": [
    { "beat": "节拍名称", "emotion": "情绪描述", "intensity": 1-10, "duration": "short|medium|long" }
  ],
  "visualStyle": {
    "colorPalette": "色彩基调例如 warm_golden / cold_blue / high_contrast",
    "lighting": "灯光风格例如 noir / natural / dramatic_chiaroscuro",
    "cameraWork": "运镜风格例如 handheld / steadicam / dolly",
    "compositionStyle": "构图风格例如 rule_of_thirds / symmetrical / dutch_angle",
    "referenceStyle": "参考风格例如 wes_anderson / christopher_nolan / wong_kar_wai"
  },
  "cinematicLanguage": [
    { "element": "镜头语言元素", "description": "具体描述", "reasoning": "为何使用此手法" }
  ],
  "pacing": "slow_burn|steady|fast_paced|dynamic|episodic",
  "targetAudience": "目标观众",
  "keyScenes": [
    { "id": "scene_001", "name": "场景名", "purpose": "叙事目的", "emotionalImpact": 1-10, "isClimax": false }
  ]
}

要求：
1. 情绪曲线必须有至少 3 个节拍
2. 色彩、灯光、运镜必须具体
3. 镜头语言至少 2 个元素
4. 关键场景至少识别 2 个
5. 如果输入太短，用合理默认值填充，不要拒绝`

/**
 * Director Brain — 分析剧本并返回导演理解
 */
export async function analyzeScript(script: string, traceId?: string, userId?: string): Promise<DirectorUnderstanding> {
  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: script.slice(0, 8000),
    userId: userId || 'director-brain',
    timeoutTier: 'batch',
  })

  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, result.content]
    const parsed = JSON.parse(jsonMatch[1].trim())
    return {
      theme: parsed.theme || '未命名主题',
      coreConflict: parsed.coreConflict || '待识别',
      genre: parsed.genre || '通用',
      overallTone: parsed.overallTone || '中性',
      emotionCurve: parsed.emotionCurve || [
        { beat: '开场', emotion: '中性', intensity: 5, duration: 'medium' },
        { beat: '发展', emotion: '期待', intensity: 6, duration: 'medium' },
        { beat: '高潮', emotion: '紧张', intensity: 8, duration: 'short' },
      ],
      visualStyle: parsed.visualStyle || {
        colorPalette: 'natural',
        lighting: 'natural',
        cameraWork: 'standard',
        compositionStyle: 'rule_of_thirds',
        referenceStyle: 'modern_cinema',
      },
      cinematicLanguage: parsed.cinematicLanguage || [],
      pacing: parsed.pacing || 'steady',
      targetAudience: parsed.targetAudience || '大众',
      keyScenes: parsed.keyScenes || [
        { id: 'scene_001', name: '开场', purpose: '建立世界观', emotionalImpact: 5, isClimax: false },
      ],
    }
  } catch {
    // degrade 时返回合理默认值
    return {
      theme: '解析中',
      coreConflict: '待分析',
      genre: '通用',
      overallTone: '中性',
      emotionCurve: [
        { beat: '开场', emotion: '中性', intensity: 5, duration: 'medium' },
        { beat: '发展', emotion: '期待', intensity: 6, duration: 'medium' },
        { beat: '高潮', emotion: '紧张', intensity: 8, duration: 'short' },
      ],
      visualStyle: {
        colorPalette: 'natural',
        lighting: 'natural',
        cameraWork: 'standard',
        compositionStyle: 'rule_of_thirds',
        referenceStyle: 'modern_cinema',
      },
      cinematicLanguage: [],
      pacing: 'steady',
      targetAudience: '大众',
      keyScenes: [
        { id: 'scene_001', name: '开场', purpose: '建立世界观', emotionalImpact: 5, isClimax: false },
      ],
    }
  }
}
