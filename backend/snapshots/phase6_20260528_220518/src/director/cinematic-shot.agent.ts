/**
 * Cinematic Shot Agent
 * 
 * 核心职责：
 * - 将导演理解转化为具体的镜头语言
 * - 景别设计（close-up / mid / wide / extreme-wide）
 * - 镜头运动（static / pan / tilt / dolly / crane / handheld）
 * - 构图（rule_of_thirds / centered / dutch / symmetry）
 * - 焦段选择（24mm / 35mm / 50mm / 85mm / 135mm）
 * - 光线设计（high_key / low_key / natural / dramatic）
 * 
 * 输出规范化的 Shot Design Plan
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'
import type { CinematicShotDescriptor } from './share.types.js'

// ============================================================
// Shot Design Plan
// ============================================================

export interface ShotDesignPlan {
  scenes: ShotScene[]
}

export interface ShotScene {
  sceneId: string
  sceneName: string
  shots: CinematicShotDescriptor[]
  mood: string
  transitions: string[]
}

const SYSTEM_PROMPT = `你是一位资深摄影指导和分镜师。请将导演意图转化为具体的镜头设计方案。

输入：剧本片段 + 导演理解
输出：每场戏的分镜头设计方案

【重要】导演理解中的 _storyConstitution 字段包含了 AIGC 制作规格数据（节奏规格、情绪规格、视觉风格等）。你的分镜设计必须与这些规格保持一致，特别是 rhythmSpec 的节奏要求和 emotionSpecs 的情感曲线。

每个镜头必须包含：
- shotType: "extreme_wide" | "wide" | "full" | "medium" | "medium_close_up" | "close_up" | "extreme_close_up" | "over_shoulder" | "two_shot" | "insert"
- lens: "18mm" | "24mm" | "35mm" | "50mm" | "85mm" | "135mm" | "200mm"
- cameraMotion: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking_left" | "tracking_right" | "crane_up" | "crane_down" | "handheld" | "steadicam" | "jib" | "drone"
- composition: "rule_of_thirds" | "centered" | "dutch" | "symmetry" | "leading_lines" | "frame_within_frame" | "golden_ratio" | "deep_space" | "shallow_space"
- lighting: "high_key" | "low_key" | "natural" | "dramatic" | "silhouette" | "rim_light" | "practical" | "motivated" | "chiaroscuro"
- depthOfField: "shallow" | "medium" | "deep"
- aspectRatio: "16:9" | "2.35:1" | "4:3" | "1:1" | "9:16"
- duration: 镜头时长（秒）
- description: 镜头描述
- narrativePurpose: 叙事目的

返回 JSON:
{
  "scenes": [
    {
      "sceneId": "scene_001",
      "sceneName": "场景名称",
      "shots": [ 每个镜头对象 ],
      "mood": "场景情绪基调",
      "transitions": ["cut", "dissolve", "fade", "wipe"]
    }
  ]
}`

export async function generateShotDesign(
  script: string,
  directorUnderstanding: any,
  traceId?: string,
  userId?: string,
): Promise<ShotDesignPlan> {
  const userPrompt = `【剧本片段】\n${script.slice(0, 3000)}\n\n【导演理解】\n${JSON.stringify(directorUnderstanding, null, 2)}

【故事宪法】
（以下字段为 AIGC 制作规格，是你的分镜设计依据）
- rhythmSpec: 节奏方案和爆点位置
- emotionSpecs: 情绪变化曲线
- visualSpecs: 整体视觉风格
- cameraSpecs: 已有镜头设计参考
- transitionSpec: 转场方式`


  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: userPrompt,
    userId: userId || 'cinematic-shot',
    timeoutTier: 'batch',
  })

  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, result.content]
    const parsed = JSON.parse(jsonMatch[1].trim())

    return {
      scenes: (parsed.scenes || []).map((scene: any) => ({
        sceneId: scene.sceneId || 'scene_unknown',
        sceneName: scene.sceneName || '未命名场景',
        shots: (scene.shots || []).map((shot: any) => ({
          shotType: shot.shotType || 'medium',
          lens: shot.lens || '50mm',
          cameraMotion: shot.cameraMotion || 'static',
          composition: shot.composition || 'rule_of_thirds',
          lighting: shot.lighting || 'natural',
          depthOfField: shot.depthOfField || 'medium',
          aspectRatio: shot.aspectRatio || '16:9',
          duration: typeof shot.duration === 'number' ? shot.duration : 3,
          description: shot.description || '',
          narrativePurpose: shot.narrativePurpose || '',
        })),
        mood: scene.mood || '中性',
        transitions: scene.transitions || ['cut'],
      })),
    }
  } catch {
    return { scenes: [] }
  }
}
