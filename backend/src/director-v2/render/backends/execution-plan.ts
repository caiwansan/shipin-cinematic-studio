/**
import { normalizeScene, normalizeExecutionPlan, normalizeProjection } from '''../../contracts/bridge/director-v2.bridge.js''';
 * execution-plan.ts — Phase 6D.2: Execution Plan Schema
 *
 * IR 的"模型无关执行层"。
 * 这一层把 CinematicRenderIR 的语义结构翻译为视频模型能理解的执行指令。
 * 所有的 backend adapter 都从这个 Plan 编译 prompt，不直接读 IR。
 *
 * 防止 prompt collapse 的核心机制：
 *   IR (语义) → ExecutionPlan (结构化) → prompt (模型语言)
 *           不可跳过↗         不可跳过↗
 */

import type { CinematicRenderIR } from './render-ir.js'

// ============================================================
// ExecutionPlan — 模型无关的"可执行计划"
// ============================================================

export interface ExecutionPlan {
  /** 源 IR ID（追溯用） */
  irId: string
  /** 版本 */
  version: string
  /** 生成时间戳 */
  createdAt: number

  // ============================================================
  // 动作指令（motion）
  // ============================================================
  scenes: ExecutionScene[]   // 每一幕

  // ============================================================
  // 全局约束
  // ============================================================
  globalConstraints: {
    maxMotionIntensity: number
    characterContinuity: boolean
    visualConsistency: boolean
    toneLocked: boolean
    forbiddenVisualStates: string[]
  }

  // ============================================================
  // 连续性锚点（角色/场景/物体跨镜头一致）
  // ============================================================
  continuityAnchors: {
    characters: string[]
    locations: string[]
    objects: string[]
  }
}

export interface ExecutionScene {
  sceneId: string
  index: number
  mood: string
  pacing: 'slow' | 'moderate' | 'fast'
  emotionalWeight: number
  shots: ExecutionShot[]
  forbiddenStates: string[]
}

export interface ExecutionShot {
  shotId: string
  shotType: string
  emotionalTension: 'low' | 'medium' | 'high'

  /** 运动指令 */
  motion: ShotMotion

  /** 摄影机指令 */
  camera: CameraInstruction

  /** 视觉指令 */
  visual: VisualInstruction

  /** 时间约束 */
  temporal: TemporalSlot

  /** 渲染描述（最终 prompt 素材） */
  renderDescriptions: string[]

  forbiddenStyles: string[]
}

export interface ShotMotion {
  intensity: number       // 0-1
  type: string            // 动作类型描述
  cameraMotion: string    // 摄影机运动
}

export interface CameraInstruction {
  shotType: string
  motion: string
  emotionalTension: 'low' | 'medium' | 'high'
}

export interface VisualInstruction {
  primaryColor: string
  palette: string
  lighting: string
  contrast: number
  brightnessOffset: number
}

export interface TemporalSlot {
  frameOrder: 'opening' | 'key_frame' | 'transition' | 'closing'
  durationHint: string
}

// ============================================================
// Normalizer — IR → ExecutionPlan
// ============================================================

export class ExecutionNormalizer {
  /**
   * 把 locked CinematicRenderIR 编译为模型无关的 ExecutionPlan
   * 这是 IR 下游的唯一入口——所有 backend 必须从 ExecutionPlan 编译 prompt
   */
  normalize(ir: CinematicRenderIR): ExecutionPlan {
    const scenes: ExecutionScene[] = ir.sceneChain.map(scene => ({
      sceneId: scene.sceneId,
      index: scene.index,
      mood: scene.mood,
      pacing: scene.pacing,
      emotionalWeight: scene.emotionalWeight,
      forbiddenStates: [...scene.forbiddenStates],
      shots: this.buildShots(scene.shots, ir.shotChain, ir.frameInstructions),
    }))

    return {
      irId: ir.irId,
      version: ir.version,
      createdAt: Date.now(),
      scenes,
      globalConstraints: {
        maxMotionIntensity: ir.constraints.maxMotionIntensity,
        characterContinuity: ir.constraints.characterContinuity,
        visualConsistency: ir.constraints.visualConsistency,
        toneLocked: ir.constraints.toneLocked,
        forbiddenVisualStates: [...ir.constraints.forbiddenVisualStates],
      },
      continuityAnchors: {
        characters: [...ir.temporalAnchors.characters],
        locations: [...ir.temporalAnchors.locations],
        objects: [...ir.temporalAnchors.objects],
      },
    }
  }

  private buildShots(
    shotIds: string[],
    allShots: CinematicRenderIR['shotChain'],
    allFrames: CinematicRenderIR['frameInstructions'],
  ): ExecutionShot[] {
    return shotIds.map(shotId => {
      const shot = allShots.find(s => s.shotId === shotId)
      if (!shot) return this.emptyShot(shotId)

      const frames = allFrames.filter(f => shot.frameIds.includes(f.frameId))

      return {
        shotId: shot.shotId,
        shotType: shot.shotType,
        emotionalTension: shot.emotionalTension,
        motion: {
          intensity: shot.motionIntensity,
          type: this.describeMotion(shot.shotType, shot.emotionalTension),
          cameraMotion: shot.cameraMotion,
        },
        camera: {
          shotType: shot.shotType,
          motion: shot.cameraMotion,
          emotionalTension: shot.emotionalTension,
        },
        visual: {
          primaryColor: shot.colorGuide.primary,
          palette: shot.colorGuide.palette,
          lighting: shot.colorGuide.lighting,
          contrast: this.averageContrast(frames),
          brightnessOffset: this.averageBrightness(frames),
        },
        temporal: {
          frameOrder: frames[0]?.type || 'key_frame',
          durationHint: this.guessDuration(shot.shotType),
        },
        renderDescriptions: frames.map(f => f.renderDescription),
        forbiddenStyles: [...shot.visualKeywords.slice(0, 2)],
      }
    })
  }

  // ============================================================
  // Helpers
  // ============================================================

  private describeMotion(shotType: string, tension: 'low' | 'medium' | 'high'): string {
    const base = shotType.toLowerCase()
    if (tension === 'high') return `rapid_${base}`
    if (tension === 'medium') return `dynamic_${base}`
    return `gentle_${base}`
  }

  private averageContrast(frames: CinematicRenderIR['frameInstructions']): number {
    if (frames.length === 0) return 0.5
    return frames.reduce((s, f) => s + f.contrast, 0) / frames.length
  }

  private averageBrightness(frames: CinematicRenderIR['frameInstructions']): number {
    if (frames.length === 0) return 0
    return frames.reduce((s, f) => s + f.brightnessOffset, 0) / frames.length
  }

  private guessDuration(shotType: string): string {
    const t = shotType.toLowerCase()
    if (t.includes('wide') || t.includes('全景')) return '4-6s'
    if (t.includes('close') || t.includes('特写')) return '2-3s'
    if (t.includes('track') || t.includes('跟踪') || t.includes('跟')) return '5-8s'
    return '3-5s'
  }

  private emptyShot(shotId: string): ExecutionShot {
    return {
      shotId,
      shotType: 'static',
      emotionalTension: 'medium',
      motion: { intensity: 0.3, type: 'static', cameraMotion: 'locked' },
      camera: { shotType: 'static', motion: 'locked', emotionalTension: 'medium' },
      visual: { primaryColor: 'slate', palette: 'neutral', lighting: 'soft', contrast: 0.5, brightnessOffset: 0 },
      temporal: { frameOrder: 'key_frame', durationHint: '3s' },
      renderDescriptions: [],
      forbiddenStyles: [],
    }
  }
}

/** 全局单例 */
export const executionNormalizer = new ExecutionNormalizer()
