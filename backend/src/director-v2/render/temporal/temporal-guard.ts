/**
 * temporal-guard.ts — Phase 6D.3: Temporal Consistency Guard
 *
 * 从 ExecutionPlan 推导帧级时间连续性约束。
 * 不凭空建帧，而是从 shot chain 的语义结构推导：
 *
 *   场景边界 → identity lock 延续
 *   镜头类型 → motion constraint 推导
 *   情绪张力 → camera trajectory 锁定
 *   视觉关键词 → scene geometry anchor
 *
 * 输出：TemporalFrameGraph — 每帧带前/后向约束的图
 *        TemporalConstraints — 全局时间约束集（注入 backend prompt）
 */

import type { ExecutionPlan, ExecutionShot } from './backends/execution-plan.js'

// ============================================================
// Types
// ============================================================

export interface TemporalFrameGraph {
  /** 帧图版本 */
  version: string
  /** 源 plan ID */
  planId: string

  /** 帧列表（带有连续性信息） */
  frames: TemporalFrame[]

  /** 全局时间约束 */
  globalConstraints: TemporalGlobalConstraints
}

export interface TemporalFrame {
  frameIndex: number
  shotId: string
  sceneId: string

  /** identity lock — 该帧必须保持的角色特征 */
  identityLock: IdentityLock

  /** post lock — 该帧的姿态约束 */
  poseConstraints: PoseConstraint[]

  /** camera lock — 摄影机状态 */
  cameraLock: CameraLock

  /** scene geometry — 场景几何锚点 */
  sceneAnchors: SceneAnchor[]

  /** 前向连续性依赖 */
  forwardContinuity: ContinuityDependency

  /** 后向连续性依赖 */
  backwardContinuity: ContinuityDependency

  /** 该帧的漂移风险 */
  driftRisk: number

  /** 是否被标记为锚点帧（identity/image seed） */
  isAnchorFrame: boolean
}

export interface IdentityLock {
  /** 该帧应保持的角色 identities */
  characters: string[]
  /** 锁定强度 (0-1) */
  strength: number
  /** 禁止的角色变换 */
  forbiddenTransformations: string[]
}

export interface PoseConstraint {
  /** 姿态类型 */
  type: string
  /** 强度 (0-1) */
  intensity: number
  /** 相对于前一帧的最大变化量 */
  maxDelta: number
}

export interface CameraLock {
  /** 摄影机运动类型 */
  motionType: string
  /** 是否遵循轨迹 */
  trajectoryConstrained: boolean
  /** 最大速度变化 */
  maxVelocityDelta: number
}

export interface SceneAnchor {
  /** 锚点类型 */
  type: 'location' | 'lighting' | 'spatial_layout' | 'object_position'
  /** 描述 */
  description: string
  /** 是否可改变 */
  mutable: boolean
}

export interface ContinuityDependency {
  /** 是否依赖前一帧 */
  depends: boolean
  /** 依赖强度 (0-1) */
  strength: number
  /** 依赖描述 */
  description: string
}

export interface TemporalGlobalConstraints {
  /** 身份连贯性 */
  identityCoherence: boolean
  /** 物体恒存 */
  objectPermanence: boolean
  /** 场景记忆 */
  sceneMemory: boolean
  /** 摄影机轨迹锁定 */
  cameraTrajectoryLock: boolean
  /** 最大帧间 pose 变化 */
  maxPoseDelta: number
  /** 最大帧间 camera 变化 */
  maxCameraDelta: number
  /** 禁止的操作 */
  forbiddenOperations: string[]
}

// ============================================================
// Temporal Guard Engine
// ============================================================

export class TemporalConsistencyGuard {
  /**
   * 从 ExecutionPlan 构建 TemporalFrameGraph
   */
  buildFrameGraph(plan: ExecutionPlan): TemporalFrameGraph {
    const frames: TemporalFrame[] = []
    let globalFrameIndex = 0

    for (const scene of plan.scenes) {
      for (const shot of scene.shots) {
        const isSceneFirst = shot.shotId === scene.shots[0]?.shotId
        const sceneTransition = isSceneFirst ? this.buildSceneTransition(scene) : null

        // Frame per shot
        const frame = this.buildFrame(shot, scene, globalFrameIndex, plan, frames, sceneTransition)
        frames.push(frame)
        globalFrameIndex++
      }
    }

    // 构建前后向依赖
    for (let i = 0; i < frames.length; i++) {
      if (i > 0) {
        frames[i].backwardContinuity = this.buildBackwardDependency(frames[i], frames[i - 1], plan)
      }
      if (i < frames.length - 1) {
        frames[i].forwardContinuity = this.buildForwardDependency(frames[i], frames[i + 1], plan)
      }
    }

    return {
      version: '1.0.0',
      planId: plan.irId,
      frames,
      globalConstraints: this.buildGlobalConstraints(plan),
    }
  }

  /**
   * 把时间约束注入为可附加到 backend prompt 的指令
   */
  compileConstraints(graph: TemporalFrameGraph): string {
    const parts: string[] = []

    // 全局约束
    parts.push('Temporal Consistency Constraints:')
    parts.push(`- Identity coherence: ${graph.globalConstraints.identityCoherence ? 'ENFORCED' : 'RELAXED'}`)
    parts.push(`- Object permanence: ${graph.globalConstraints.objectPermanence ? 'ENFORCED' : 'RELAXED'}`)
    parts.push(`- Scene memory: ${graph.globalConstraints.sceneMemory ? 'ENFORCED' : 'RELAXED'}`)
    parts.push(`- Max frame delta: ${graph.globalConstraints.maxCameraDelta}`)

    // 锚点帧（seed frame）
    const anchors = graph.frames.filter(f => f.isAnchorFrame)
    if (anchors.length > 0) {
      parts.push('\nSeed/Anchor Frames (identity locks):')
      for (const a of anchors) {
        parts.push(`- Frame ${a.frameIndex} (${a.shotId}): characters=[${a.identityLock.characters.join(', ')}], strength=${a.identityLock.strength}`)
      }
    }

    // 禁止操作
    parts.push('\nForbidden:')
    parts.push(graph.globalConstraints.forbiddenOperations.map(op => `- ${op}`).join('\n'))

    return parts.join('\n')
  }

  /**
   * 检测帧间的 temporal drift
   */
  detectDrift(graph: TemporalFrameGraph): TemporalDriftReport {
    const highRiskFrames: number[] = []
    const identityBreaks: number[] = []
    const cameraBreaks: number[] = []

    for (let i = 0; i < graph.frames.length; i++) {
      const curr = graph.frames[i]

      if (curr.driftRisk > 0.7) {
        highRiskFrames.push(curr.frameIndex)
      }

      if (i === 0) continue // skip comparison for first frame
      const prev = graph.frames[i - 1]

      // 跨场景 identity 检查
      if (curr.sceneId !== prev.sceneId) {
        const commonChars = curr.identityLock.characters.filter(c =>
          prev.identityLock.characters.includes(c),
        )
        if (commonChars.length > 0 && curr.identityLock.strength < 0.5) {
          identityBreaks.push(curr.frameIndex)
        }
      }

      // camera 突变检测
      if (curr.cameraLock.motionType !== prev.cameraLock.motionType) {
        cameraBreaks.push(curr.frameIndex)
      }
    }

    return {
      totalFrames: graph.frames.length,
      highRiskFrames,
      identityBreaks,
      cameraBreaks,
      score: highRiskFrames.length > graph.frames.length * 0.3 ? 'UNSTABLE' :
             identityBreaks.length > 0 ? 'CONCERN' : 'STABLE',
    }
  }

  // ============================================================
  // Internal builders
  // ============================================================

  private buildFrame(
    shot: ExecutionShot,
    scene: ExecutionPlan['scenes'][0],
    frameIndex: number,
    plan: ExecutionPlan,
    priorFrames: TemporalFrame[],
    sceneTransition: string | null,
  ): TemporalFrame {
    const isSceneFirst = priorFrames.length === 0 || shot.shotId === scene.shots[0]?.shotId
    const isAnchorFrame = frameIndex === 0 || (isSceneFirst && priorFrames.length > 0)

    return {
      frameIndex,
      shotId: shot.shotId,
      sceneId: scene.sceneId,
      identityLock: this.buildIdentityLock(plan, shot, scene),
      poseConstraints: this.buildPoseConstraints(shot, scene),
      cameraLock: this.buildCameraLock(shot),
      sceneAnchors: this.buildSceneAnchors(plan, scene, isSceneFirst),
      forwardContinuity: { depends: false, strength: 0, description: 'init' },
      backwardContinuity: { depends: false, strength: 0, description: 'init' },
      driftRisk: this.estimateDriftRisk(shot, scene, isSceneFirst, priorFrames.length),
      isAnchorFrame,
    }
  }

  private buildIdentityLock(plan: ExecutionPlan, shot: ExecutionShot, _scene: ExecutionPlan['scenes'][0]): IdentityLock {
    return {
      characters: [...plan.continuityAnchors.characters],
      strength: shot.emotionalTension === 'high' ? 0.9 : shot.emotionalTension === 'medium' ? 0.7 : 0.5,
      forbiddenTransformations: [
        'gender_shift',
        'age_shift',
        'costume_color_drift',
        'facial_feature_change',
      ],
    }
  }

  private buildPoseConstraints(shot: ExecutionShot, _scene: ExecutionPlan['scenes'][0]): PoseConstraint[] {
    const constraints: PoseConstraint[] = []

    // 基于 shot type 推导姿态约束
    if (shot.shotType.includes('全景') || shot.shotType.includes('wide')) {
      constraints.push({ type: 'full_body_position', intensity: 0.5, maxDelta: 0.3 })
    } else if (shot.shotType.includes('特写') || shot.shotType.includes('close')) {
      constraints.push({ type: 'facial_expression', intensity: 0.9, maxDelta: 0.1 })
      constraints.push({ type: 'head_position', intensity: 0.8, maxDelta: 0.15 })
    } else if (shot.shotType.includes('跟踪') || shot.shotType.includes('track')) {
      constraints.push({ type: 'body_movement_trajectory', intensity: 0.7, maxDelta: 0.25 })
    } else {
      constraints.push({ type: 'general_continuity', intensity: 0.6, maxDelta: 0.2 })
    }

    // 高张力 shot 增加约束强度
    if (shot.emotionalTension === 'high') {
      constraints.forEach(c => { c.intensity = Math.min(c.intensity * 1.2, 1.0) })
    }

    return constraints
  }

  private buildCameraLock(shot: ExecutionShot): CameraLock {
    return {
      motionType: shot.camera.motion,
      trajectoryConstrained: shot.motion.intensity > 0.5,
      maxVelocityDelta: shot.motion.intensity > 0.7 ? 0.3 : 0.5,
    }
  }

  private buildSceneAnchors(plan: ExecutionPlan, scene: ExecutionPlan['scenes'][0], isSceneFirst: boolean): SceneAnchor[] {
    const anchors: SceneAnchor[] = []

    anchors.push({
      type: 'location',
      description: plan.continuityAnchors.locations[scene.index % Math.max(plan.continuityAnchors.locations.length, 1)] || 'generic',
      mutable: !isSceneFirst,
    })

    anchors.push({
      type: 'lighting',
      description: this.deriveLighting(scene.mood),
      mutable: false,
    })

    if (scene.shots.length > 0) {
      anchors.push({
        type: 'spatial_layout',
        description: scene.shots[0].shotType,
        mutable: false,
      })
    }

    return anchors
  }

  private buildSceneTransition(scene: ExecutionPlan['scenes'][0]): string {
    return `scene_transition_to_${scene.mood}_${scene.pacing}`
  }

  private estimateDriftRisk(shot: ExecutionShot, scene: ExecutionPlan['scenes'][0], isSceneFirst: boolean, priorCount: number): number {
    let risk = 0.1 // baseline

    // 情绪转变增加漂移风险
    if (isSceneFirst && priorCount > 0) risk += 0.15
    if (scene.pacing === 'fast') risk += 0.1
    if (shot.motion.intensity > 0.7) risk += 0.1
    if (shot.emotionalTension === 'high') risk += 0.05

    return Math.min(risk, 0.9)
  }

  private deriveLighting(mood: string): string {
    const moodMap: Record<string, string> = {
      '平静': 'soft_even',
      '紧张': 'harsh_contrast',
      '激烈': 'dynamic_flash',
      '喜悦': 'warm_golden',
      '悲伤': 'cool_blue',
      '悬疑': 'low_key_shadow',
      'neutral': 'flat_diffuse',
    }
    return moodMap[mood] || moodMap['neutral']
  }

  private buildForwardDependency(curr: TemporalFrame, next: TemporalFrame, _plan: ExecutionPlan): ContinuityDependency {
    // 跨场景时需要更强的连续性
    if (curr.sceneId !== next.sceneId) {
      const sameChars = curr.identityLock.characters.filter(c => next.identityLock.characters.includes(c))
      if (sameChars.length > 0) {
        return { depends: true, strength: 0.8, description: 'character_continuity_across_scene_boundary' }
      }
      return { depends: false, strength: 0.3, description: 'scene_transition' }
    }

    return { depends: true, strength: 0.6, description: 'temporal_continuity_within_scene' }
  }

  private buildBackwardDependency(curr: TemporalFrame, prev: TemporalFrame, _plan: ExecutionPlan): ContinuityDependency {
    if (curr.sceneId !== prev.sceneId) {
      return { depends: true, strength: 0.5, description: 'scene_boundary_preceding' }
    }
    if (curr.cameraLock.motionType !== prev.cameraLock.motionType) {
      return { depends: true, strength: 0.4, description: 'camera_change_from_previous' }
    }
    return { depends: true, strength: 0.7, description: 'direct_frame_continuity' }
  }

  private buildGlobalConstraints(plan: ExecutionPlan): TemporalGlobalConstraints {
    return {
      identityCoherence: plan.globalConstraints.characterContinuity,
      objectPermanence: true,
      sceneMemory: plan.globalConstraints.visualConsistency,
      cameraTrajectoryLock: true,
      maxPoseDelta: 0.3,
      maxCameraDelta: plan.globalConstraints.maxMotionIntensity > 0.6 ? 0.5 : 0.3,
      forbiddenOperations: [
        'frame_reset',
        'identity_rewrite',
        'scene_reinitialization',
        'temporal_skip',
        'pose_reinitialization',
      ],
    }
  }
}

// ============================================================
// Drift Report
// ============================================================

export interface TemporalDriftReport {
  totalFrames: number
  highRiskFrames: number[]
  identityBreaks: number[]
  cameraBreaks: number[]
  score: 'STABLE' | 'CONCERN' | 'UNSTABLE'
}

/** 全局单例 */
export const temporalGuard = new TemporalConsistencyGuard()
