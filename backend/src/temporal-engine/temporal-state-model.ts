/**
 * Temporal State Model
 * Temporal Consistency Engine — 时间连续性引擎
 *
 * 时间状态模型：相邻镜头之间需要保持连续的物理状态。
 *
 * 每个镜头被抽取为一个 TemporalState，包含：
 *   - cameraState: 摄像机位置/方向/焦距（决定镜头切换不跳）
 *   - lightingState: 光照强度/色温（决定画面不跳色）
 *   - motionState: 画面运动速度/方向（决定运动不跳帧）
 *
 * 设计原则：
 *   - 所有值为数值，支持 lerp/smooth 插值
 *   - 3D 位置用 [x,y,z] 三元组
 *   - 2D 方向用 [x,y] 二元组（平面运动方向角度）
 */

import { CinematicShot } from '../cinematic-compiler/cinematic-dsl-schema'

/**
 * 摄像机状态（3D 空间）
 */
export interface CameraState {
  /** 3D 空间位置 [x, y, z] */
  position: [number, number, number]
  /** 朝向向量 [x, y, z] */
  direction: [number, number, number]
  /** 焦距（mm） */
  focalLength: number
  /** 运动类型索引（0=static, 1=dolly, 2=crane, 3=drone...） */
  movementType: number
}

/**
 * 光照状态
 */
export interface LightingState {
  /** 光照强度（0~1, 0=全黑, 1=全亮） */
  intensity: number
  /** 色温（开尔文, 2700~6500） */
  colorTemperature: number
  /** 光照方向角度（0~360°） */
  directionAngle: number
}

/**
 * 运动状态
 */
export interface MotionState {
  /** 运动速度量级（0~10） */
  velocity: number
  /** 运动方向 [x, y]（归一化平面向量） */
  direction: [number, number]
  /** 是否手持（0=稳定, 1=手持） */
  handheldIntensity: number
}

/**
 * 完整时间状态快照
 */
export interface TemporalState {
  /** 场景 ID */
  sceneId: string
  /** 摄像机状态 */
  camera: CameraState
  /** 光照状态 */
  lighting: LightingState
  /** 运动状态 */
  motion: MotionState
  /** 时间戳（ms, 相对起始时间） */
  timestamp: number
}

// ─── 映射表：CinematicShot → TemporalState ───

/**
 * 镜头焦距 → 数值
 */
export function lensToMm(lens: string): number {
  const map: Record<string, number> = {
    '16mm': 16, '18mm': 18, '24mm': 24, '35mm': 35,
    '50mm': 50, '85mm': 85, '100mm': 100, '135mm': 135, '200mm': 200,
  }
  return map[lens] || 35
}

/**
 * 运镜类型 → 索引
 */
export function movementToType(movement: string): number {
  const map: Record<string, number> = {
    static: 0, pan_left: 1, pan_right: 1,
    tilt_up: 2, tilt_down: 2,
    dolly_in: 3, dolly_out: 3,
    track_left: 4, track_right: 4,
    crane_up: 5, crane_down: 5,
    zoom_in: 6, zoom_out: 6,
    whip_left: 7, whip_right: 7,
  }
  return map[movement] ?? 0
}

/**
 * 运动速度 → 数值
 */
export function speedToVelocity(speed: string): number {
  const map: Record<string, number> = { slow: 2, normal: 5, fast: 8, hyper: 10 }
  return map[speed] || 3
}

/**
 * 光照类型 → 强度
 */
export function lightingToIntensity(type: string): number {
  const map: Record<string, number> = {
    low_key: 0.2, silhouette: 0.15, neon: 0.4,
    chiaroscuro: 0.5, practical: 0.5, natural: 0.6,
    golden_hour: 0.7, motivated: 0.7, high_key: 0.85,
    high_contrast: 0.8, ambient: 0.5,
  }
  return map[type] ?? 0.5
}

/**
 * 色温 → 数值
 */
export function colorToneToTemp(tone: string): number {
  const map: Record<string, number> = { warm: 3200, neutral: 5000, cool: 6500, teal_orange: 4500, monochrome: 5000 }
  return map[tone] ?? 5000
}

/**
 * 光照方向 → 角度
 */
export function directionToAngle(dir: string): number {
  const map: Record<string, number> = {
    front: 0, three_quarter_front: 45, side: 90, three_quarter_back: 135,
    back: 180, top: 270, under: 90,
  }
  return map[dir] ?? 0
}

/**
 * 从 CinematicShot 提取 TemporalState
 */
export function shotToTemporalState(
  shot: CinematicShot,
  sceneId: string,
  timestamp: number,
): TemporalState {
  return {
    sceneId,
    camera: {
      position: [0, 0, 0], // 需后续结合上下文填充
      direction: [0, 0, 1],
      focalLength: lensToMm(shot.camera.lens),
      movementType: movementToType(shot.camera.movement),
    },
    lighting: {
      intensity: lightingToIntensity(shot.lighting.type),
      colorTemperature: colorToneToTemp(shot.lighting.colorTone),
      directionAngle: directionToAngle(shot.lighting.direction),
    },
    motion: {
      velocity: speedToVelocity(shot.motion.speed),
      direction: [1, 0],
      handheldIntensity: shot.motion.handheld ? 0.8 : 0,
    },
    timestamp,
  }
}
