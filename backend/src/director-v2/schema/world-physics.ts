/**
 * World Physics — 世界物理
 *
 * 定义世界观和物理规则。
 * 用于确保不同 agent 对"这个世界如何运作"有一致理解。
 * 也是 Atmosphere Agent 的设计依据。
 */

export interface WorldPhysics {
  /** 环境类型 */
  environmentType: EnvironmentType

  /** 时代 */
  timePeriod: string

  /** 物理异常（超自然/科幻要素） */
  physicsAnomalies: PhysicsAnomaly[]

  /** 世界尺度 */
  scale: WorldScale

  /** 季节/气候 */
  defaultClimate?: string

  /** 社会技术水平 */
  techLevel?: 'primitive' | 'medieval' | 'industrial' | 'modern' | 'near_future' | 'scifi' | 'fantasy'
}

export type EnvironmentType =
  | 'realistic'
  | 'fantasy'
  | 'sci_fi'
  | 'post_apocalyptic'
  | 'historical'
  | 'surreal'
  | 'abstract'

export type WorldScale =
  | 'intimate'   // 室内/小空间
  | 'human'      // 人类尺度
  | 'epic'       // 宏大（战争/史诗）
  | 'cosmic'     // 宇宙尺度

// ============================================================
// Physics Anomaly
// ============================================================

export interface PhysicsAnomaly {
  /** 异常名称 */
  name: string

  /** 描述 */
  description: string

  /** 对视觉的影响 */
  visualImpact: string

  /** 出现场景 */
  triggerScenes?: string[]
}
