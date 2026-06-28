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

import { buildPromptCached } from './prompt-service.js'

// ⭐ 从 PromptService 读取（统一入口）
let systemPromptPromise: Promise<string> | null = null
async function getSystemPrompt(): Promise<string> {
  if (!systemPromptPromise) {
    systemPromptPromise = (async () => {
      const result = await buildPromptCached({ agentName: 'scene-image-prompt-agent' })
      return result.prompt
    })()
  }
  return systemPromptPromise
}

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
    systemPrompt: await getSystemPrompt(),
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

