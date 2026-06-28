/**
 * director-bridge.ts — Dual-Output Bridge
 *
 * 连接新的 Semantic Kernel（director-v2）和旧的 Director Layer（director/）。
 * 支持渐进式迁移：旧 agent 继续消费 legacy DirectorUnderstanding，新 agent 消费 StoryConstitution。
 *
 * 迁移流程：
 *   Stage 1（当前）：dual output — 同时返回旧格式和新 Constitution
 *   Stage 2：逐个 agent 切换到新 Constitution
 *   Stage 3：删除 bridge
 */

import { constitutionCompiler, type ConstitutionCompileResult } from './constitution-compiler.js'
import { createDefaultConstitution, type StoryConstitution } from './schema/story-constitution.js'

// ============================================================
// 旧 DirectorUnderstanding 的类型（从 director/director-brain.agent.ts 同步）
// ============================================================

interface OldDirectorUnderstanding {
  theme: string
  coreConflict: string
  genre: string
  overallTone: string
  emotionCurve: OldEmotionBeat[]
  visualStyle: OldVisualStyle
  cinematicLanguage: OldCinematicLanguage[]
  pacing: string
  targetAudience: string
  keyScenes: OldKeyScene[]
}

interface OldEmotionBeat {
  beat: string
  emotion: string
  intensity: number
  duration: 'short' | 'medium' | 'long'
}

interface OldVisualStyle {
  colorPalette: string
  lighting: string
  cameraWork: string
  compositionStyle: string
  referenceStyle: string
}

interface OldCinematicLanguage {
  element: string
  description: string
  reasoning: string
}

interface OldKeyScene {
  id: string
  name: string
  purpose: string
  emotionalImpact: number
  isClimax: boolean
}

// ============================================================
// Bridge Result
// ============================================================

export interface BridgeResult {
  /** 新的 Story Constitution */
  constitution: StoryConstitution

  /** 旧的 DirectorUnderstanding（兼容层） */
  legacy: OldDirectorUnderstanding

  /** 编译结果 */
  compileResult: ConstitutionCompileResult
}

// ============================================================
// Bridge 转换函数
// ============================================================

function constitutionToLegacyUnderstanding(constitution: StoryConstitution): OldDirectorUnderstanding {
  return {
    theme: constitution.coreTheme,
    coreConflict: constitution.emotionalTrajectory.dominantEmotion,
    genre: determineGenre(constitution),
    overallTone: constitution.emotionalTrajectory.dominantEmotion,
    emotionCurve: constitution.emotionalTrajectory.segments.map(s => ({
      beat: s.name,
      emotion: s.primaryEmotion,
      intensity: s.intensity,
      duration: toLegacyDuration(s.durationRatio),
    })),
    visualStyle: {
      colorPalette: constitution.visualDoctrine.colorDoctrine.primaryPalette.join(', ') || 'natural',
      lighting: constitution.visualDoctrine.lightingDoctrine.baseApproach,
      cameraWork: constitution.visualDoctrine.cameraDoctrine.preferredMotions[0] || 'standard',
      compositionStyle: constitution.visualDoctrine.compositionDoctrine.defaultComposition,
      referenceStyle: constitution.cinematicIdentity.primaryInfluences[0] || 'modern_cinema',
    },
    cinematicLanguage: [],
    pacing: constitution.pacingDoctrine.pacingCurve,
    targetAudience: deriveAudience(constitution),
    keyScenes: constitution.emotionalTrajectory.segments.map((s, i) => ({
      id: s.id,
      name: s.name,
      purpose: s.trigger || '',
      emotionalImpact: s.intensity,
      isClimax: s.intensity >= 8,
    })),
  }
}

function determineGenre(constitution: StoryConstitution): string {
  const env = constitution.worldPhysics.environmentType
  const era = constitution.cinematicIdentity.eraTags[0] || ''
  if (env === 'fantasy') return '奇幻'
  if (env === 'sci_fi') return '科幻'
  if (env === 'historical') return '历史'
  if (env === 'post_apocalyptic') return '末世'
  if (era === 'neo_noir') return '黑色'
  return '通用'
}

function toLegacyDuration(ratio: number): 'short' | 'medium' | 'long' {
  if (ratio < 0.2) return 'short'
  if (ratio < 0.4) return 'medium'
  return 'long'
}

function deriveAudience(constitution: StoryConstitution): string {
  for (const tb of constitution.toneBoundaries) {
    if (tb.dimension === 'violence' && tb.max > 6) return '成人'
  }
  return '大众'
}

// ============================================================
// Director Bridge
// ============================================================

export class DirectorBridge {
  /**
   * 编译 Constitution 并同时生成旧格式输出
   */
  async compile(params: {
    script: string
    projectId: string
    userId?: string
    traceId?: string
  }): Promise<BridgeResult> {
    const compileResult = await constitutionCompiler.compile(params)

    const legacy = compileResult.success
      ? constitutionToLegacyUnderstanding(compileResult.constitution)
      : this.defaultLegacyUnderstanding()

    return {
      constitution: compileResult.constitution,
      legacy,
      compileResult,
    }
  }

  /**
   * 降级时的旧格式默认值（保持接口稳定）
   */
  private defaultLegacyUnderstanding(): OldDirectorUnderstanding {
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

/** 全局单例 */
export const directorBridge = new DirectorBridge()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

