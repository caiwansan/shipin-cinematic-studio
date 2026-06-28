/**
 * render-adapter.ts — Phase 6C.4: Render Engine Adapter Layer
 *
 * 把 Director OS 的"语义结构"翻译为"可执行视觉指令"。
 *
 * 核心原则：
 *   ✔ 只读：projection layer / intent layer / energy summary（不接触 raw runtime）
 *   ❌ 不读取：raw constitution / drift graph / memory state / intervention history
 *
 * 翻译路径：
 *   Scene → Shot → Frame → CinematicRenderIR
 *
 * 输出：
 *   中立的 Render Instruction Set，不依赖任何具体的 render engine。
 *   AIGC pipeline 可以接这个输出直接生成视频指令。
 */

import type {
  DirectorStatus,
  ScenePreview,
  ShotPlan,
  IntentTimeline,
} from './director-projection.js'
import type { SafeIntentHint } from './projection-input-types.js'

// ============================================================
// Types — Cinematic Render IR
// ============================================================

/** 完整「视像 → AI 渲染管线」指令集 */
export interface CinematicRenderIR {
  /** 元信息 */
  projectTitle: string
  renderId: string
  timestamp: number
  /** 连续性哈希（用于检测漂移导致的渲染差异） */
  continuityFingerprint: string

  /** 场景链 */
  scenes: RenderScene[]
  /** 全局约束 */
  globalConstraints: RenderConstraints
  /** 连续性锚点 */
  continuityAnchors: Record<string, string | boolean | number>
}

/** 单场景渲染指令 */
export interface RenderScene {
  sceneId: string
  index: number

  /** 情绪 */
  mood: string
  /** 节奏 */
  pacing: 'slow' | 'moderate' | 'fast'
  /** 叙事功能 */
  narrativeFunction: string
  /** 情感权重 0-1 */
  emotionalWeight: number

  /** 本场景的镜头列表 */
  shots: RenderShot[]
  /** 禁止状态（不进入该场景的视觉引导） */
  forbiddenStates: string[]
}

/** 单镜头渲染指令 */
export interface RenderShot {
  shotId: string
  shotType: string
  /** 镜头情绪张力 */
  emotionalTension: 'low' | 'medium' | 'high'
  /** 色彩引导 */
  colorGuide: {
    primary: string
    palette: string
    lighting: string
  }
  /** 运动强度 0-1 */
  motionIntensity: number
  /** 摄影机运动 */
  cameraMotion: string
  /** 视觉关键词（给 render engine 做 prompt） */
  visualKeywords: string[]
  /** 帧指令 */
  frames: FrameInstruction[]
}

/** 帧级渲染指令（最细粒度） */
export interface FrameInstruction {
  type: 'opening' | 'key_frame' | 'transition' | 'closing'
  /** 对比度 0-1 */
  contrast: number
  /** 亮度偏移 */
  brightnessOffset: number
  /** 渲染 prompt */
  renderDescription: string
  /** 禁止镜头语言 */
  forbiddenStyles: string[]
}

/** 全局渲染约束 */
export interface RenderConstraints {
  /** 是否保持角色连续性 */
  characterContinuity: boolean
  /** 是否保持视觉风格一致 */
  visualConsistency: boolean
  /** 是否锁定色调范围 */
  toneLocked: boolean
  /** 运动上限 */
  maxMotionIntensity: number
  /** 禁止的视觉状态 */
  forbiddenVisualStates: string[]
}

// ============================================================
// Render Adapter — 只读投影层翻译器
// ============================================================

export class RenderAdapter {
  private renderCount: number = 0

  /**
   * 生成完整的 CinematicRenderIR
   * 只读输入：projection layer output + intent summary + energy summary
   */
  compile(
    status: DirectorStatus,
    scenes: ScenePreview[],
    timeline: IntentTimeline,
    shotsByScene: Record<string, ShotPlan[]>,
  ): CinematicRenderIR {
    this.renderCount++
    const renderId = `RENDER_${Date.now()}_${this.renderCount}`
    const now = Date.now()

    // Continuity fingerprint — 只基于投影数据
    const fingerprintData = [
      status.stability,
      status.emotionalTone,
      status.visualStyle,
      timeline.emotionalArc.start,
      timeline.emotionalArc.end,
      timeline.pacingDescription,
      scenes.map(s => s.emotionalShift).join('|'),
      scenes.map(s => s.visualKeywords.join(',')).join(';'),
    ].join('::')

    // ============================================================
    // Scene-Level Mapping
    // ============================================================
    const renderScenes: RenderScene[] = scenes.map((scene, idx) => {
      const shots = shotsByScene[scene.sceneId] || []

      return {
        sceneId: scene.sceneId,
        index: idx,
        mood: scene.emotionalShift || status.emotionalTone,
        pacing: this.mapPacing(timeline.pacingDescription),
        narrativeFunction: scene.title,
        emotionalWeight: this.deriveEmotionalWeight(scene, idx, scenes.length),
        shots: shots.map((shot, sIdx) => this.mapShot(shot, scene, sIdx)),
        forbiddenStates: ['drift_violation', 'tone_break', 'identity_shift'],
      }
    })

    // ============================================================
    // Global Constraints
    // ============================================================
    const constraints: RenderConstraints = {
      characterContinuity: true,
      visualConsistency: true,
      toneLocked: status.stability !== 'notable_shift',
      maxMotionIntensity: status.energy === 'intense' ? 0.9 : status.energy === 'building' ? 0.6 : 0.3,
      forbiddenVisualStates: ['motion_blur_abuse', 'over_contrast', 'color_bleeding'],
    }

    return {
      projectTitle: status.projectTitle,
      renderId,
      timestamp: now,
      continuityFingerprint: this.hash(fingerprintData),
      scenes: renderScenes,
      globalConstraints: constraints,
      continuityAnchors: {
        projectTitle: status.projectTitle,
        emotionalTone: status.emotionalTone,
        stabilityLocked: status.stability === 'stable',
        characters: status.keyCharacters.join(','),
      },
    }
  }

  /**
   * 单镜头映射
   */
  private mapShot(shot: ShotPlan, scene: ScenePreview, index: number): RenderShot {
    const palette = this.matchVisualToPalette(scene.visualKeywords)
    const motion = this.deriveMotionIntensity(shot.emotionalTension)

    return {
      shotId: shot.shotId || `shot_${scene.sceneId}_${index}`,
      shotType: shot.shotType || 'static',
      emotionalTension: shot.emotionalTension,
      colorGuide: {
        primary: shot.visualPrimary || palette.primary,
        palette: palette.palette,
        lighting: palette.lighting,
      },
      motionIntensity: motion,
      cameraMotion: this.mapCameraMotion(shot.shotType, shot.emotionalTension),
      visualKeywords: scene.visualKeywords,
      frames: this.buildFrames(index, shot.emotionalTension, palette),
    }
  }

  /**
   * 构建帧级指令（开场 / 关键帧 / 过渡 / 结束）
   */
  private buildFrames(
    shotIndex: number,
    tension: 'low' | 'medium' | 'high',
    palette: { primary: string; palette: string; lighting: string },
  ): FrameInstruction[] {
    const baseContrast = tension === 'high' ? 0.7 : tension === 'medium' ? 0.5 : 0.3
    const forbiddenStyle = this.getForbiddenStyles(tension)

    return [
      {
        type: shotIndex === 0 ? 'opening' : 'transition',
        contrast: baseContrast * 0.8,
        brightnessOffset: 0,
        renderDescription: `Establishing frame: ${palette.palette} tones, ${palette.lighting} lighting`,
        forbiddenStyles: forbiddenStyle,
      },
      {
        type: 'key_frame',
        contrast: baseContrast,
        brightnessOffset: -0.1,
        renderDescription: `Key frame: ${palette.primary} dominance, ${palette.lighting} ambiance`,
        forbiddenStyles: forbiddenStyle,
      },
      {
        type: 'closing',
        contrast: baseContrast * 0.6,
        brightnessOffset: -0.2,
        renderDescription: `Closing frame: fade to ${palette.palette} shadow`,
        forbiddenStyles: forbiddenStyle,
      },
    ]
  }

  // ============================================================
  // Helpers
  // ============================================================

  private mapPacing(description: string): 'slow' | 'moderate' | 'fast' {
    const d = description.toLowerCase()
    if (d.includes('快') || d.includes('fast') || d.includes('急促') || d.includes('紧张')) return 'fast'
    if (d.includes('慢') || d.includes('缓慢') || d.includes('subtle')) return 'slow'
    return 'moderate'
  }

  private deriveEmotionalWeight(scene: ScenePreview, idx: number, total: number): number {
    // 三幕结构：开场低 -> 冲突爬升 -> 高潮/回落
    if (total <= 1) return 0.5
    const progress = idx / (total - 1)
    if (progress < 0.3) return 0.3 + progress * 0.5 // rise
    if (progress < 0.7) return 0.5 + (progress - 0.3) * 1.0 // peak
    return 0.8 - (progress - 0.7) * 1.0 // fall
  }

  private deriveMotionIntensity(tension: 'low' | 'medium' | 'high'): number {
    const map = { low: 0.2, medium: 0.5, high: 0.8 }
    return map[tension]
  }

  private matchVisualToPalette(keywords: string[]): { primary: string; palette: string; lighting: string } {
    const all = keywords.join(' ').toLowerCase()
    if (all.includes('night') || all.includes('暗') || all.includes('黑')) {
      return { primary: 'dark_blue', palette: 'nocturne', lighting: 'low_key' }
    }
    if (all.includes('sun') || all.includes('亮') || all.includes('光')) {
      return { primary: 'gold', palette: 'warm_daylight', lighting: 'natural' }
    }
    if (all.includes('neon') || all.includes('霓虹') || all.includes('科幻')) {
      return { primary: 'cyan', palette: 'synthwave', lighting: 'neon' }
    }
    if (all.includes('war') || all.includes('战斗') || all.includes('暴')) {
      return { primary: 'crimson', palette: 'battle_worn', lighting: 'harsh' }
    }
    return { primary: 'slate', palette: 'neutral_balanced', lighting: 'soft_diffuse' }
  }

  private mapCameraMotion(shotType: string, tension: 'low' | 'medium' | 'high'): string {
    const type = shotType.toLowerCase()
    if (type.includes('wide') || type.includes('全景')) return tension === 'high' ? 'slow_dolly_in' : 'static'
    if (type.includes('close') || type.includes('特写')) return tension === 'high' ? 'rapid_push' : 'slow_zoom'
    if (type.includes('track') || type.includes('跟')) return 'tracking'
    if (type.includes('static') || type.includes('固定')) return 'locked'
    return 'gentle_pan'
  }

  private getForbiddenStyles(tension: 'low' | 'medium' | 'high'): string[] {
    const base = ['motion_blur_abuse', 'lens_flare']
    if (tension === 'low') return [...base, 'rapid_cut', 'shake']
    if (tension === 'medium') return [...base, 'excessive_shake']
    return base
  }

  /** 简单的哈希函数 */
  private hash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash).toString(36).padStart(8, '0')
  }

  /** 获取当前 render count */
  getRenderCount(): number {
    return this.renderCount
  }
}

/** 全局单例 */
export const renderAdapter = new RenderAdapter()
