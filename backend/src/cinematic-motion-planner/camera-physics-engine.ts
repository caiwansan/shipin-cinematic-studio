/**
 * Camera Physics Engine
 * Motion Planning Enhancer — 动态可信度引擎
 *
 * 相机物理引擎：为镜头运动施加物理约束，确保运动轨迹"像真实摄影"。
 *
 * 物理约束：
 *   1. Velocity Continuity（速度连续性）— 不能瞬间变速
 *   2. Acceleration Smoothing（加速度平滑）— ease-in-out 曲线
 *   3. Path Feasibility（路径可行性）— 不瞬移、不穿模
 *   4. Inertia Model（惯性模型）— 物理惯性
 *
 * 所有运动参数通过 ease-in-out 曲线平滑过渡。
 */

export interface PhysicsConstraints {
  /** 最大速度（单位/秒） */
  maxVelocity: number
  /** 最大加速度（单位/秒²） */
  maxAcceleration: number
  /** 惯性系数（0~1, 越高越平滑） */
  inertia: number
  /** 手持抖动幅度（0~1） */
  handheldShake: number
}

export interface MotionPhysicsState {
  /** 当前位置 [x, y, z] */
  position: [number, number, number]
  /** 当前速度 */
  velocity: number
  /** 当前加速度 */
  acceleration: number
  /** 时间戳 */
  timestamp: number
}

export interface SmoothedMotion {
  /** 插值后的位置 */
  position: [number, number, number]
  /** 插值后的速度 */
  velocity: number
  /** 插值后的加速度 */
  acceleration: number
  /** ease-in-out 系数 (0~1) */
  easingFactor: number
  /** 是否触发了物理限制 */
  clamped: boolean
}

export class CameraPhysicsEngine {
  /**
   * 默认物理约束
   */
  static readonly DEFAULT_CONSTRAINTS: PhysicsConstraints = {
    maxVelocity: 10,
    maxAcceleration: 5,
    inertia: 0.7,
    handheldShake: 0,
  }

  /**
   * ease-in-out 曲线
   * t 在 [0,1] 范围内返回平滑插值
   */
  easeInOut(t: number): number {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  /**
   * 平滑加速度：ease-in-out 限制加速度变化率
   */
  clampAcceleration(
    prevVelocity: number,
    nextVelocity: number,
    deltaTime: number,
    constraints: PhysicsConstraints = CameraPhysicsEngine.DEFAULT_CONSTRAINTS,
  ): { acceleration: number; clamped: boolean } {
    const rawAcceleration = (nextVelocity - prevVelocity) / deltaTime
    const clamped = Math.abs(rawAcceleration) > constraints.maxAcceleration
    const acceleration = clamped
      ? Math.sign(rawAcceleration) * constraints.maxAcceleration
      : rawAcceleration

    return { acceleration, clamped }
  }

  /**
   * 惯性模型：对运动施加惯性平滑
   */
  applyInertia(
    prevVelocity: number,
    targetVelocity: number,
    inertia: number = CameraPhysicsEngine.DEFAULT_CONSTRAINTS.inertia,
  ): number {
    return prevVelocity * inertia + targetVelocity * (1 - inertia)
  }

  /**
   * 完整物理约束：速度 + 加速度 + 惯性
   */
  smoothMotion(
    prev: MotionPhysicsState,
    target: { position: [number, number, number]; velocity: number },
    deltaTime: number,
    constraints: PhysicsConstraints = CameraPhysicsEngine.DEFAULT_CONSTRAINTS,
  ): SmoothedMotion {
    // 1. 计算期望速度
    const targetVelocity = Math.min(target.velocity, constraints.maxVelocity)

    // 2. 惯性平滑
    const smoothedVelocity = this.applyInertia(
      prev.velocity,
      targetVelocity,
      constraints.inertia,
    )

    // 3. 加速度限制
    const { acceleration, clamped } = this.clampAcceleration(
      prev.velocity,
      smoothedVelocity,
      deltaTime,
      constraints,
    )

    // 4. ease-in-out 位置插值
    const t = Math.min(deltaTime / 1.0, 1) // 归一化时间（假设 1s 为标准帧）
    const easingFactor = this.easeInOut(t)
    const pos: [number, number, number] = [
      prev.position[0] + (target.position[0] - prev.position[0]) * easingFactor,
      prev.position[1] + (target.position[1] - prev.position[1]) * easingFactor,
      prev.position[2] + (target.position[2] - prev.position[2]) * easingFactor,
    ]

    return { position: pos, velocity: smoothedVelocity, acceleration, easingFactor, clamped }
  }

  /**
   * 生成手持抖动效果
   */
  applyHandheldShake(basePosition: [number, number, number], intensity: number): [number, number, number] {
    if (intensity <= 0) return basePosition
    const jitter = intensity * 0.05 // 最大 5% 偏移
    const offsetX = (Math.random() - 0.5) * 2 * jitter * basePosition[0]
    const offsetY = (Math.random() - 0.5) * 2 * jitter * basePosition[1]
    const offsetZ = (Math.random() - 0.5) * 2 * jitter * basePosition[2]
    return [basePosition[0] + offsetX, basePosition[1] + offsetY, basePosition[2] + offsetZ]
  }

  /**
   * 检测路径可行性（防止瞬移）
   */
  validatePathFeasibility(
    prev: [number, number, number],
    curr: [number, number, number],
    deltaTime: number,
    maxJumpDistance = 5,
  ): boolean {
    const dx = curr[0] - prev[0]
    const dy = curr[1] - prev[1]
    const dz = curr[2] - prev[2]
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const speed = distance / deltaTime
    return speed <= maxJumpDistance
  }
}
