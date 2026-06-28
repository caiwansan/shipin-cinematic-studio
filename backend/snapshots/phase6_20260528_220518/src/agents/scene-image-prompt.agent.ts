/**
 * Scene Image Prompt Agent
 *
 * 职责：
 * - 从统筹 agent 拿到场景分析数据
 * - 按【场景图优化需求表单】标准格式向 AI 提交优化请求
 * - AI 填入优化后的提示词，agent 返回给前端渲染到场景卡片
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

// ============================================================
// Types
// ============================================================

export interface SceneImagePromptInput {
  script: string
  atmosphereScenes: {
    sceneId: string
    sceneName: string
    timeOfDay: string
    weather: string
    temperature: string
    colorPalette: string[]
    lightingDescription: string
    spaceTexture: string
    keyProps: string[]
    mood: string
    atmosphereVisualKeywords: string[]
  }[]
}

export interface SceneImagePromptOutput {
  sceneId: string
  scenePrompt: string
  negativePrompt: string
}

const SYSTEM_PROMPT = `你是一位顶级 AI 文生图提示词工程师。

你将收到每个场景的【场景图优化需求表单】，请按照标准 AIGC 提示词格式输出优化后的提示词。

【标准 AIGC 提示词格式】
每条场景图提示词必须包含以下要素，按顺序拼接：
1. Scene name identifier（场景名称标识）
2. Time of day + weather description（时间+天气描述）
3. Lighting description（光源、方向、色温、光比）
4. Color palette（色彩体系）
5. Space texture（空间质感）
6. Props description（关键道具）
7. Mood/atmosphere keywords（情绪氛围关键词）
8. Camera: wide shot, 16:9, empty scene, no people
9. Quality: cinematic composition, photorealistic, 8k, high detail, professional lighting

【规则】
- 必须英文
- 每个场景的提示词在 200-400 字符之间
- 严格不能包含人物/角色/生物描述（由 negativePrompt 处理）
- 只返回 JSON 数组，不要 markdown 包裹

【输出格式】
[
  {
    "scenePrompt": "Scene: XXX ... wide shot, empty scene, 16:9, cinematic composition, 8k...",
    "negativePrompt": "people, character, person, figure, silhouette, text, watermark, signature"
  }
]`

export async function generateSceneImagePrompts(
  input: SceneImagePromptInput
): Promise<SceneImagePromptOutput[]> {
  const sceneForms = input.atmosphereScenes.map((s, i) => `【场景图优化需求 #${i + 1}】
场景名: ${s.sceneName}
剧情概括: ${input.script.slice(0, 200)}
环境类型: ${s.weather === 'indoor' ? '室内' : '室外'}
时间: ${s.timeOfDay}
天气: ${s.weather}
情绪基调: ${s.mood}
场景外观描述: ${s.lightingDescription} ${s.spaceTexture}
该场景道具: ${(s.keyProps || []).join(', ') || '无'}
`).join('\n---\n')

  const userMessage = `【剧本全文】\n${input.script.slice(0, 2000)}\n\n=== 场景图优化需求表单（共 ${input.atmosphereScenes.length} 个场景）===\n\n${sceneForms}\n\n请严格按照输出格式返回每个场景的优化后提示词，数组顺序与表单顺序一致。`

  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    userId: 'scene-image-prompt',
    timeoutTier: 'batch',
  })

  try {
    const content = result.content.trim()
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, content]
    const parsed = JSON.parse(jsonMatch[1].trim())

    if (Array.isArray(parsed)) {
      return parsed.map((item: any, i: number) => ({
        sceneId: input.atmosphereScenes[i]?.sceneId || `scene_${i + 1}`,
        scenePrompt: item.scenePrompt || '',
        negativePrompt: item.negativePrompt || 'people, character, person, figure, silhouette, text, watermark, signature',
      }))
    }

    if (parsed.scenes && Array.isArray(parsed.scenes)) {
      return parsed.scenes.map((item: any, i: number) => ({
        sceneId: input.atmosphereScenes[i]?.sceneId || `scene_${i + 1}`,
        scenePrompt: item.scenePrompt || '',
        negativePrompt: item.negativePrompt || 'people, character, person, figure, silhouette, text, watermark, signature',
      }))
    }
  } catch {
    // 解析失败
  }

  return input.atmosphereScenes.map(s => ({
    sceneId: s.sceneId,
    scenePrompt: '',
    negativePrompt: 'people, character, person, figure, silhouette, text, watermark, signature',
  }))
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

