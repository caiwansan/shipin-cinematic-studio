/**
 * story/global-arc.ts — Phase 2 跨场景全局弧线
 *
 * 职责：从 CompileSceneGraph + per-scene IR 推导：
 *   - 全局情绪弧线
 *   - 镜头连续性图
 *   - 角色连续性图
 *
 * 宪法：
 *   1. 纯 deterministic（相同场景 IR 永远相同弧线）
 *   2. 不修改 IR schema
 *   3. 不调 LLM
 *   4. per-scene IR 由上游 DirectorIR pipeline 提供，此处只消费
 */

import type { DirectorIR } from '../prompt/director-ir.js'
import type { CompileSceneGraph, SceneNode } from './scene-graph.js'

// ─── 类型 ─────────────────────────────────────────────────────────

export interface GlobalArc {
  emotionCurve: GlobalEmotionPoint[]
  cameraContinuity: CrossSceneCamera[]
  characterContinuity: CrossSceneCharacter[]
  narrativePacing: NarrativePacing
}

export interface GlobalEmotionPoint {
  sceneId: string
  sceneType: string
  sceneIndex: number  // 叙事位置 0-3
  emotion: string
  valence: number
  arousal: number
}

export interface CrossSceneCamera {
  fromSceneId: string
  toSceneId: string
  shotTransition: string  // "consistent" | "shift" | "contrast"
  note: string
}

export interface CrossSceneCharacter {
  characterId: string
  name: string
  appearanceScenes: string[]  // 出现在哪些场景
  archetypeEvolution: string[] // 原型演变
}

export interface NarrativePacing {
  totalScenes: number
  intensityArc: string[]     // 每个场景的强度标签
  dominantMood: string       // 整体基调
  moodStability: number      // 0-1（情绪一致性）
}

// ─── 场景类型 → 情绪基调映射 ─────────────────────────────────

const SCENE_MOOD_MAP: Record<string, { valence: number; arousal: number; label: string }> = {
  intro:       { valence: 0.3, arousal: 0.3, label: 'curious, calm' },
  conflict:    { valence: -0.4, arousal: 0.7, label: 'tense, uneasy' },
  escalation:  { valence: -0.7, arousal: 0.9, label: 'intense, desperate' },
  resolution:  { valence: 0.5, arousal: 0.4, label: 'relieved, resolved' },
  custom:      { valence: 0, arousal: 0.5, label: 'neutral' },
}

// ─── 镜头过渡规则 ────────────────────────────────────────────

function inferShotTransition(fromType: string, toType: string): { transition: string; note: string } {
  const pairs: Record<string, Record<string, string>> = {
    intro: {
      conflict: 'shift — calm → tension',
      escalation: 'shift — calm → intensity',
      resolution: 'contrast — calm → relief',
    },
    conflict: {
      escalation: 'consistent — escalating tension',
      resolution: 'shift — tension → relief',
    },
    escalation: {
      resolution: 'contrast — descent from peak',
    },
  }

  const transition = pairs[fromType]?.[toType] ?? 'shift — default transition'
  const shotLabel = transition.startsWith('consistent') ? 'consistent' : transition.startsWith('contrast') ? 'contrast' : 'shift'
  return { transition: shotLabel, note: transition }
}

// ─── compileGlobalArc ──────────────────────────────────────

/**
 * 从 scene graph + per-scene IR 编译全局弧线
 *
 * 不生成 IR，只做跨场景推导
 */
export function compileGlobalArc(
  graph: CompileSceneGraph,
  sceneIRs: Record<string, DirectorIR>,
  storyTitle?: string
): GlobalArc {
  const emotionCurve: GlobalEmotionPoint[] = []
  const cameraContinuity: CrossSceneCamera[] = []
  const characterAppearance: Record<string, { name: string; scenes: string[]; archetypes: string[] }> = {}
  const intensityArc: string[] = []

  graph.sequence.forEach((sceneId, i) => {
    const scene = graph.index[sceneId]
    const ir = sceneIRs[sceneId]
    const moodBase = SCENE_MOOD_MAP[scene.type] ?? SCENE_MOOD_MAP.custom

    // 情绪点
    emotionCurve.push({
      sceneId,
      sceneType: scene.type,
      sceneIndex: i,
      emotion: moodBase.label,
      valence: moodBase.valence,
      arousal: moodBase.arousal,
    })

    // 强度标签
    if (moodBase.arousal > 0.7) intensityArc.push('high')
    else if (moodBase.arousal > 0.4) intensityArc.push('medium')
    else intensityArc.push('low')

    // 角色追踪
    if (ir?.characters) {
      for (const char of ir.characters) {
        if (!characterAppearance[char.continuityKey]) {
          characterAppearance[char.continuityKey] = {
            name: char.name,
            scenes: [],
            archetypes: [],
          }
        }
        characterAppearance[char.continuityKey].scenes.push(sceneId)
        if (!characterAppearance[char.continuityKey].archetypes.includes(char.archetype)) {
          characterAppearance[char.continuityKey].archetypes.push(char.archetype)
        }
      }
    }

    // 镜头连续性（跨场景）
    if (i > 0) {
      const prevSceneId = graph.sequence[i - 1]
      const prevScene = graph.index[prevSceneId]
      const { transition, note } = inferShotTransition(prevScene.type, scene.type)
      cameraContinuity.push({
        fromSceneId: prevSceneId,
        toSceneId: sceneId,
        shotTransition: transition,
        note,
      })
    }
  })

  // 角色连续性
  const characterContinuity: CrossSceneCharacter[] = Object.entries(characterAppearance).map(
    ([id, data]) => ({
      characterId: id,
      name: data.name,
      appearanceScenes: data.scenes,
      archetypeEvolution: data.archetypes,
    })
  )

  // 主导情绪
  const moodCounts: Record<string, number> = {}
  emotionCurve.forEach(e => {
    moodCounts[e.emotion] = (moodCounts[e.emotion] || 0) + 1
  })
  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'

  // 情绪稳定性（相同 mood 的比例）
  const dominantCount = moodCounts[dominantMood] ?? 0
  const moodStability = graph.sequence.length > 0 ? dominantCount / graph.sequence.length : 0

  return {
    emotionCurve,
    cameraContinuity,
    characterContinuity,
    narrativePacing: {
      totalScenes: graph.sequence.length,
      intensityArc,
      dominantMood,
      moodStability: Math.round(moodStability * 100) / 100,
    },
  }
}

export default { compileGlobalArc }
