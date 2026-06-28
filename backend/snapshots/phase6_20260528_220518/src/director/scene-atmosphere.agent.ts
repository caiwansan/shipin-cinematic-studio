/**
 * Scene Atmosphere Agent
 *
 * 职责：
 * - 世界观氛围设计
 * - 光影和色彩体系
 * - 时间和天气设定
 * - 空间质感和环境细节
 * - 每场戏的情绪基调
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

// ============================================================
// Atmosphere Design
// ============================================================

export interface SceneAtmosphereDesign {
  scenes: AtmosphereEntry[]
  worldColorSystem: string
}

export interface AtmosphereEntry {
  sceneId: string
  sceneName: string
  timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night' | 'late_night'
  weather: 'clear' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'snowy' | 'indoor'
  temperature: 'cold' | 'cool' | 'warm' | 'hot'
  colorPalette: string[]
  lightingDescription: string
  spaceTexture: string
  keyProps: string[]
  mood: string
  atmosphereVisualKeywords: string[]
}

const SYSTEM_PROMPT = `你是一位顶级场景设计师和氛围艺术家。
根据故事文本和导演理解，设计每场戏的氛围和世界观视觉系统。

【重要】导演理解中的 _storyConstitution 字段包含了 AIGC 制作规格（场景规格、视觉风格、氛围要求等）。你的场景设计必须与这些规格一致，不得偏离故事主线的世界设定。

每场戏必须包含：
- 时间、天气、温度
- 色彩体系（主色、辅色、强调色）
- 灯光描述
- 空间质感
- 关键道具
- 情绪基调

输出 JSON:
{
  "scenes": [{
    "sceneId": "scene_001",
    "sceneName": "场景名",
    "timeOfDay": "dawn|morning|noon|afternoon|dusk|night|late_night",
    "weather": "clear|cloudy|rainy|stormy|foggy|snowy|indoor",
    "temperature": "cold|cool|warm|hot",
    "colorPalette": ["主色", "辅色", "强调色"],
    "lightingDescription": "灯光描述",
    "spaceTexture": "空间质感描述",
    "keyProps": ["道具1", "道具2"],
    "mood": "情绪基调",
    "atmosphereVisualKeywords": ["氛围关键词"]
  }],
  "worldColorSystem": "世界观色彩体系总体描述"
}`

export async function generateAtmosphereDesign(
  script: string,
  directorUnderstanding: any,
  traceId?: string,
): Promise<SceneAtmosphereDesign> {
  const userPrompt = `【剧本片段】\n${script.slice(0, 3000)}\n\n【导演理解】\n${JSON.stringify(directorUnderstanding, null, 2)}

【故事宪法】
（以下字段为 AIGC 制作规格，是你的场景氛围设计依据）
- sceneSpecs: 场景基本设定
- visualSpecs: 整体视觉风格约束
- styleSpec: 美术风格方向`


  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: userPrompt,
    userId: 'scene-atmosphere',
    timeoutTier: 'batch',
  })

  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, result.content]
    const parsed = JSON.parse(jsonMatch[1].trim())
    return {
      scenes: (parsed.scenes || []).map((s: any) => ({
        sceneId: s.sceneId || 'scene_unknown',
        sceneName: s.sceneName || '未命名场景',
        timeOfDay: s.timeOfDay || 'noon',
        weather: s.weather || 'clear',
        temperature: s.temperature || 'warm',
        colorPalette: s.colorPalette || ['#FFFFFF', '#CCCCCC', '#000000'],
        lightingDescription: s.lightingDescription || '',
        spaceTexture: s.spaceTexture || '',
        keyProps: s.keyProps || [],
        mood: s.mood || '中性',
        atmosphereVisualKeywords: s.atmosphereVisualKeywords || [],
      })),
      worldColorSystem: parsed.worldColorSystem || '自然色彩体系',
    }
  } catch {
    return { scenes: [], worldColorSystem: '自然色彩体系' }
  }
}
