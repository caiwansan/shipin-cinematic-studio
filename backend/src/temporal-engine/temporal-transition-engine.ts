/**
 * Temporal Transition Engine
 * Temporal Consistency Engine — 时间连续性引擎
 *
 * 镜头过渡引擎：计算两个相邻 TemporalState 之间的平滑过渡参数。
 *
 * 过渡策略：
 *   - 摄像机位置：线性插值（lerp）
 *   - 方向：取目标方向（方向突变有合理逻辑——切镜）
 *   - 焦距：平滑过渡（smooth = 70% prev + 30% next）
 *   - 光照强度/色温：平滑过渡（避免跳色）
 *   - 运动速度：平滑过渡（避免跳速）
 *
 * Continuity Score：衡量两个镜头之间的"连续度"
 *   - 0 ~ 1 之间，越高越连续
 *   - 低于阈值时注入显式过渡指令
 */

import { TemporalState, CameraState, LightingState, MotionState } from './temporal-state-model'

export interface TransitionedState {
  camera: CameraState
  lighting: LightingState
  motion: MotionState
  /** 连续性分数（0~1） */
  continuityScore: number
}

export class TemporalTransitionEngine {
  /**
   * 计算从 prev 到 next 的平滑过渡
   */
  transition(prev: TemporalState, next: TemporalState): TransitionedState {
    return {
      camera: this.transitionCamera(prev.camera, next.camera),
      lighting: this.transitionLighting(prev.lighting, next.lighting),
      motion: this.transitionMotion(prev.motion, next.motion),
      continuityScore: this.calculateContinuityScore(prev, next),
    }
  }

  /**
   * 计算连续性分数
   * 越低表示越需要注入过渡提示
   */
  private calculateContinuityScore(prev: TemporalState, next: TemporalState): number {
    const focalDiff = Math.abs(prev.camera.focalLength - next.camera.focalLength) / 200
    const lightDiff = Math.abs(prev.lighting.intensity - next.lighting.intensity)
    const motionDiff = Math.abs(prev.motion.velocity - next.motion.velocity) / 10
    const movementChange = prev.camera.movementType !== next.camera.movementType ? 0.3 : 0
    const handheldDiff = Math.abs(prev.motion.handheldIntensity - next.motion.handheldIntensity)

    const penalty = focalDiff + lightDiff + motionDiff + movementChange + handheldDiff
    return Math.max(0, Math.min(1, 1 - penalty))
  }

  /**
   * 是否需要注入过渡提示
   */
  needsTransitionHint(score: number, threshold = 0.5): boolean {
    return score < threshold
  }

  // ─── 各维度的平滑过渡 ───

  private transitionCamera(prev: CameraState, next: CameraState): CameraState {
    return {
      // 位置 lerp: 平滑过渡到新位置
      position: this.lerp3(prev.position, next.position),
      // 方向：直接取目标（切镜是正常的）
      direction: next.direction,
      // 焦距 smooth: 70% 旧 + 30% 新（避免突然变焦）
      focalLength: this.smooth(prev.focalLength, next.focalLength, 0.7),
      // 运镜类型：如果相同则保持，不同则过渡到新类型
      movementType: next.movementType,
    }
  }

  private transitionLighting(prev: LightingState, next: LightingState): LightingState {
    return {
      intensity: this.smooth(prev.intensity, next.intensity, 0.7),
      colorTemperature: this.smooth(prev.colorTemperature, next.colorTemperature, 0.7),
      directionAngle: next.directionAngle, // 光位可以突变（合理的）
    }
  }

  private transitionMotion(prev: MotionState, next: MotionState): MotionState {
    return {
      velocity: this.smooth(prev.velocity, next.velocity, 0.6),
      direction: next.direction,
      handheldIntensity: this.smooth(prev.handheldIntensity, next.handheldIntensity, 0.5),
    }
  }

  // ─── 数值工具 ───

  private lerp(a: number, b: number, t = 0.5): number {
    return a + (b - a) * t
  }

  private lerp3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
    return [this.lerp(a[0], b[0]), this.lerp(a[1], b[1]), this.lerp(a[2], b[2])]
  }

  private smooth(prev: number, next: number, factor: number): number {
    return prev * factor + next * (1 - factor)
  }
}
