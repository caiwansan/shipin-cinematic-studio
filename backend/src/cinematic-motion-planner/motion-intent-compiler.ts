/**
 * Motion Intent Compiler
 * Motion Planning Enhancer — 动态可信度引擎
 *
 * 运动意图编译器：从 sceneGraph + emotionalArc + shotType 推导出每个镜头的运动意图向量。
 *
 * MotionIntentVector 维度：
 *   - pressure (0~1): 画面压迫感（高 = 靠近、仰角、紧迫）
 *   - intimacy (0~1): 亲密感（高 = 近距、私密）
 *   - instability (0~1): 不稳定性（高 = 晃动、手持感）
 *   - energy_flow (−1~+1): 能量流动（负 = 收敛/释放, 正 = 推高/紧张）
 *
 * 映射规则（ShotGrammarType → 运动策略）：
 *   establishing  → static / slow reveal（静止或缓慢展示）
 *   build_up     → gradual dolly-in / increasing pressure（渐近推入）
 *   peak         → shake / fast orbit / constrained chaos（摇晃/快速环绕）
 *   release      → dolly-out / stabilization（退出/稳定）
 */

import { ShotGrammarType } from '../cinematic-grammar/shot-grammar-tree'

export interface MotionIntentVector {
  /** 画面压迫感 (0~1) */
  pressure: number
  /** 亲密感 (0~1) */
  intimacy: number
  /** 不稳定性 (0~1) */
  instability: number
  /** 能量流动方向 (−1~+1, 负=释放, 正=累积) */
  energyFlow: number
  /** 建议的相机运动类型 */
  recommendedMovement: string
}

export class MotionIntentCompiler {
  /**
   * 根据语法类型 + 强度推导运动意图
   */
  compile(
    grammarType: ShotGrammarType,
    intensity: number,
    emotionalTension: number,
  ): MotionIntentVector {
    // 基础策略：语法类型决定运动基底
    switch (grammarType) {
      case 'establishing':
        return {
          pressure: 0.1 + intensity * 0.2,
          intimacy: 0.1,
          instability: 0,
          energyFlow: -0.3,
          recommendedMovement: 'static_panoramic',
        }

      case 'build_up':
        return {
          pressure: 0.3 + intensity * 0.4 + emotionalTension * 0.3,
          intimacy: 0.3 + intensity * 0.3,
          instability: 0.1 + intensity * 0.2,
          energyFlow: 0.3 + intensity * 0.3 + emotionalTension * 0.2,
          recommendedMovement: 'gradual_dolly_in',
        }

      case 'peak':
        return {
          pressure: 0.7 + intensity * 0.3 + emotionalTension * 0.2,
          intimacy: 0.5 + intensity * 0.3,
          instability: 0.6 + intensity * 0.3 + emotionalTension * 0.2,
          energyFlow: 0.7 + intensity * 0.3,
          recommendedMovement: 'shake_orbit',
        }

      case 'release':
        return {
          pressure: Math.max(0, 0.5 - intensity * 0.3),
          intimacy: 0.2 + intensity * 0.2,
          instability: Math.max(0, 0.4 - intensity * 0.3),
          energyFlow: -0.5 - intensity * 0.3,
          recommendedMovement: 'dolly_out_stabilize',
        }

      case 'reaction':
        return {
          pressure: 0.2 + emotionalTension * 0.4,
          intimacy: 0.6 + intensity * 0.3,
          instability: 0.1 + emotionalTension * 0.2,
          energyFlow: -0.1 - emotionalTension * 0.2,
          recommendedMovement: 'slow_pull_focus',
        }

      case 'insert':
        return {
          pressure: 0.1,
          intimacy: 0.8 + intensity * 0.2,
          instability: 0,
          energyFlow: 0,
          recommendedMovement: 'static_detail',
        }

      case 'transition':
        return {
          pressure: 0.1,
          intimacy: 0.1,
          instability: 0,
          energyFlow: -0.2,
          recommendedMovement: 'slow_pan_or_fade',
        }

      default:
        return {
          pressure: 0.3,
          intimacy: 0.3,
          instability: 0.1,
          energyFlow: 0,
          recommendedMovement: 'static',
        }
    }
  }

  /**
   * 批量编译：输入序列 → 运动意图向量列表
   */
  compileBatch(
    grammarTypes: ShotGrammarType[],
    intensities: number[],
    tensions: number[],
  ): MotionIntentVector[] {
    return grammarTypes.map((type, i) =>
      this.compile(type, intensities[i] || 0.5, tensions[i] || 0.5),
    )
  }
}
