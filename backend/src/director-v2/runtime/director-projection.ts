/**
import { normalizeScene, normalizeExecutionPlan, normalizeProjection } from '''../../contracts/bridge/director-v2.bridge.js''';
 * director-projection.ts — Director Projection API (Phase 5A)
 *
 * 昆仑镜前端看到的东西不是"内部状态"，是"语义投影"。
 * 这一层把 Director OS 的内部状态压缩为用户能理解、能安全交互的抽象。
 *
 * 核心原则：
 *   1. UI 只能看到投影层（compressed / intentional）
 *   2. UI 只能通过 safe intent hint 交互（refine / regenerate）
 *   3. 禁止直接暴露 internal score / drift / intervention / constitution raw
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import { cinmaticEnergy, EnergyProfile } from './semantic-energy.js'

// ============================================================
// Projection Types — UI 可见的"安全表面"
// ============================================================

/** UI-safe 状态总结 */
export interface DirectorStatus {
  /** 项目标题 */
  projectTitle: string
  /** 当前语义状态——用自然语言而非分数 */
  stability: 'stable' | 'mild_variance' | 'notable_shift'
  /** 当前叙事能量 */
  energy: 'calm' | 'building' | 'intense'
  /** 当前情感焦点 */
  emotionalTone: string
  /** 视觉风格说明 */
  visualStyle: string
  /** 关键角色 */
  keyCharacters: string[]
  /** 上次更新时间 */
  updatedAt: number
}

/** 剧情分镜预览（scene-level abstraction） */
export interface ScenePreview {
  sceneId: string
  title: string
  beats: string[]
  emotionalShift: string
  visualKeywords: string[]
  description?: string
}

/** 意图时间线 */
export interface IntentTimeline {
  emotionalArc: {
    start: string
    middle: string
    end: string
  }
  pacingDescription: string
  genreTags: string[]
  narrativePath: string[]
}

/** 拍摄计划（shot-level abstraction） */
export interface ShotPlan {
  shotId: string
  sceneId: string
  shotType: string
  emotionalTension: 'low' | 'medium' | 'high'
  visualPrimary: string
  duration: string
}

/** 可安全调用的生成结果 */
export interface GenerationResult {
  projectId: string
  status: 'ready' | 'processing' | 'failed'
  title: string
  /** 预览片段（非原始 constitution） */
  preview: DirectorStatus
  scenes: ScenePreview[]
}

/** 用户可提交的安全意图提示（UI 唯一能输入的内容） */
export interface SafeIntentHint {
  type: 'refine_tone' | 'adjust_pacing' | 'shift_focus' | 'regenerate'
  hint?: string
  targetAspect?: string
}

// ============================================================
// Projection Engine
// ============================================================

const STABILITY_MAP: Record<string, DirectorStatus['stability']> = {
  'ALIGNED': 'stable',
  'DIVERGING': 'mild_variance',
  'MISALIGNED': 'notable_shift',
  'LOST': 'notable_shift',
}

const ENERGY_MAP: Record<string, DirectorStatus['energy']> = {
  'very_high': 'intense',
  'high': 'intense',
  'medium': 'building',
  'low': 'calm',
  'very_low': 'calm',
}

export class DirectorProjection {
  /**
   * 从 full constitution 压缩为 UI-safe 的 DirectorStatus
   *
   * 核心压缩策略：
   * - 分数 → 自然语言等级
   * - 内部状态 → 用户可见描述
   * - 不暴露任何 raw confidence / drift / intervention
   */
  projectStatus(
    constitution: StoryConstitution,
    coherenceLevel: string,
    energy: EnergyProfile,
  ): DirectorStatus {
    const emotion = constitution.emotionalTrajectory || {}
    const visual = constitution.visualDoctrine || {}
    const chars = (constitution.characterLaws || []).map(c => String(c.name || c.characterId || ''))

    return {
      projectTitle: String(constitution.coreTheme || constitution.projectId || '').slice(0, 60),
      stability: STABILITY_MAP[coherenceLevel] || 'stable',
      energy: ENERGY_MAP[energy.level] || 'building',
      emotionalTone: String(emotion.dominantEmotion || emotion.resolutionTone || '悬疑'),
      visualStyle: `${String(visual.colorPalette || '暗调')} / ${String(visual.lighting || '低光')}`,
      keyCharacters: chars.slice(0, 8),
      updatedAt: Date.now(),
    }
  }

  /**
   * 从 constitution 提取 UI-safe 的场景预览
   * 不暴露任何原始 API 输出——只输出 scene-level abstraction
   */
  projectScenes(constitution: StoryConstitution, sceneDescriptions?: string[]): ScenePreview[] {
    const emotion = constitution.emotionalTrajectory || {}
    const pacing = constitution.pacingDoctrine || {}
    const visual = constitution.visualDoctrine || {}
    const chars = (constitution.characterLaws || []).map(c => String(c.name || c.characterId || ''))

    const scenes: ScenePreview[] = []

    // 三幕结构 → 3 scenes（prolog / conflict / climax）
    scenes.push(this.buildScene('scene_1', '序幕', chars, emotion, visual, pacing, 0, sceneDescriptions?.[0]))
    scenes.push(this.buildScene('scene_2', '冲突展开', chars, emotion, visual, pacing, 1, sceneDescriptions?.[1]))
    scenes.push(this.buildScene('scene_3', '高潮与解决', chars, emotion, visual, pacing, 2, sceneDescriptions?.[2]))

    return scenes
  }

  /**
   * 提取情感弧线时间线
   */
  projectTimeline(constitution: StoryConstitution): IntentTimeline {
    const emotion = constitution.emotionalTrajectory || {}
    const pacing = constitution.pacingDoctrine || {}
    const world = constitution.worldPhysics || {}

    return {
      emotionalArc: {
        start: String(emotion.dominantEmotion || '平静'),
        middle: this.inferMidEmotion(emotion),
        end: String(emotion.resolutionTone || '希望'),
      },
      pacingDescription: this.describePacing(pacing),
      genreTags: [String(world.environmentType || ''), String(world.timePeriod || '')].filter(Boolean),
      narrativePath: ['建立', '冲突', '转折', '高潮', '解决'],
    }
  }

  /**
   * 从 constitution 生成 shot-level plan（不暴露 raw 结构）
   */
  projectShots(constitution: StoryConstitution, sceneId: string): ShotPlan[] {
    const baseShots: { type: string; tension: ShotPlan['emotionalTension']; visual: string }[] = [
      { type: '全景', tension: 'low', visual: 'establishing' },
      { type: '中景', tension: 'medium', visual: 'dialogue' },
      { type: '特写', tension: 'high', visual: 'emotional' },
    ]

    return baseShots.map((s, i) => ({
      shotId: `shot_${sceneId}_${i + 1}`,
      sceneId,
      shotType: s.type,
      emotionalTension: s.tension,
      visualPrimary: `${String(constitution.visualDoctrine?.colorPalette || 'dark')}_${s.visual}`,
      duration: i === 0 ? '3s' : i === 1 ? '5s' : s.tension === 'high' ? '4s' : '3s',
    }))
  }

  /**
   * 处理用户的安全意图提示
   * 这是 UI 能调用的唯一 mutation 接口
   */
  processIntentHint(
    constitution: StoryConstitution,
    hint: SafeIntentHint,
  ): { modified: boolean; status: DirectorStatus } {
    switch (hint.type) {
      case 'refine_tone': {
        // 允许用户调整风格方向
        const emotion = { ...(constitution.emotionalTrajectory || {}) }
        if (hint.hint) {
          emotion.dominantEmotion = hint.hint
        }
        const modified = { ...constitution, emotionalTrajectory: emotion }
        return {
          modified: true,
          status: this.projectStatus(modified, 'ALIGNED', { level: 'medium', total: 0.5, isExpressive: false, dimensions: [] }),
        }
      }
      case 'adjust_pacing': {
        const pacing = { ...(constitution.pacingDoctrine || {}) }
        if (hint.targetAspect === 'faster') {
          pacing.pacingCurve = 'accelerating'
        } else if (hint.targetAspect === 'slower') {
          pacing.pacingCurve = 'steady'
        }
        const modified = { ...constitution, pacingDoctrine: pacing }
        return {
          modified: true,
          status: this.projectStatus(modified, 'ALIGNED', { level: 'medium', total: 0.5, isExpressive: false, dimensions: [] }),
        }
      }
      case 'regenerate':
      case 'shift_focus':
        // 这些类型需要回到 compiler 重新生成
        return {
          modified: false,
          status: this.projectStatus(constitution, 'ALIGNED', { level: 'medium', total: 0.5, isExpressive: false, dimensions: [] }),
        }
    }
  }

  /**
   * 构建完整生成结果（前端主要入口）
   */
  buildResult(
    projectId: string,
    constitution: StoryConstitution,
    coherenceLevel: string,
    energy: EnergyProfile,
    sceneDescriptions?: string[],
  ): GenerationResult {
    const status = this.projectStatus(constitution, coherenceLevel, energy)
    const scenes = this.projectScenes(constitution, sceneDescriptions)

    return {
      projectId,
      status: 'ready',
      title: status.projectTitle,
      preview: status,
      scenes,
    }
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  private buildScene(
    sceneId: string,
    title: string,
    chars: string[],
    emotion: Record<string, unknown>,
    visual: Record<string, unknown>,
    pacing: Record<string, unknown>,
    index: number,
    description?: string,
  ): ScenePreview {
    const beats = [
      chars.length > 0 ? `${chars[0]} 登场` : '叙事开始',
      index === 1 ? '冲突升级' : index === 2 ? '真相揭示' : '建立情境',
      index === 2 ? '情感高潮' : '情绪转变',
    ]

    const shifts = ['平静→紧张', '紧张→冲突', '冲突→释放']
    const keywords = [String(visual.colorPalette || '暗调'), String(emotion.dominantEmotion || '悬疑')]

    return {
      sceneId,
      title,
      beats,
      emotionalShift: shifts[index] || '转变',
      visualKeywords: keywords,
      description,
    }
  }

  private inferMidEmotion(emotion: Record<string, unknown>): string {
    const dominant = String(emotion.dominantEmotion || '')
    if (!dominant) return '紧张'
    const opposites: Record<string, string> = {
      '希望': '冲突',
      '快乐': '阴影',
      '平静': '骤变',
      '绝望': '抗争',
      '悬疑': '揭示',
    }
    return opposites[dominant] || `${dominant}×张力`
  }

  private describePacing(pacing: Record<string, unknown>): string {
    const curve = String(pacing.pacingCurve || '')
    const map: Record<string, string> = {
      'crescendo': '渐进加速，情绪稳步堆积',
      'accelerating': '节奏持续加快，张力递增',
      'staccato': '断裂变化，情绪跳跃',
      'steady': '匀速推进，细节铺陈',
      'decrescendo': '逐渐放缓，情绪释放',
    }
    return map[curve] || '叙事节奏平衡'
  }
}

/** 全局单例 */
export const directorProjection = new DirectorProjection()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

