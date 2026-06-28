/**
 * Shot-Motion Binder
 * Motion Planning Enhancer — 动态可信度引擎
 *
 * 镜头-运动绑定器：将 shotGrammarNode + motionIntentVector 绑定为统一的镜头运动事件。
 *
 * 绑定规则：
 *   peak + shake/tight → 放紧张力
 *   release + dolly-out → 降低张力
 *   confrontation + dolly-in → 增加压迫
 *   establishing + static → 建立空间
 *
 * 输出：UnifiedCinematicEvent — 包含镜头全部运动信息的完整事件。
 */

import { ShotGrammarType } from '../cinematic-grammar/shot-grammar-tree'
import { MotionIntentVector } from './motion-intent-compiler'

export interface UnifiedCinematicEvent {
  /** 镜头索引 */
  shotIndex: number
  /** 语法类型 */
  grammarType: ShotGrammarType
  /** 运动意图向量 */
  motionIntent: MotionIntentVector
  /** 打包后的运动指令 */
  motionDirective: string
  /** 运动叙事效果描述 */
  narrativeEffect: string
  /** 镜头运动风格标签 */
  motionStyle: string
}

export class ShotMotionBinder {
  /**
   * 绑定单个镜头
   */
  bind(
    shotIndex: number,
    grammarType: ShotGrammarType,
    intent: MotionIntentVector,
  ): UnifiedCinematicEvent {
    const motionStyle = this.inferMotionStyle(grammarType, intent)
    const narrativeEffect = this.inferNarrativeEffect(grammarType, intent)

    const motionDirective = this.buildMotionDirective(motionStyle, intent)

    return {
      shotIndex,
      grammarType,
      motionIntent: intent,
      motionDirective,
      narrativeEffect,
      motionStyle,
    }
  }

  /**
   * 批量绑定
   */
  bindBatch(
    grammarTypes: ShotGrammarType[],
    intentVectors: MotionIntentVector[],
  ): UnifiedCinematicEvent[] {
    if (grammarTypes.length !== intentVectors.length) {
      throw new Error(
        `grammarTypes (${grammarTypes.length}) 与 intentVectors (${intentVectors.length}) 长度不一致`,
      )
    }
    return grammarTypes.map((type, i) => this.bind(i, type, intentVectors[i]))
  }

  // ─── 私有方法 ───

  /**
   * 推断运动风格标签
   */
  private inferMotionStyle(type: ShotGrammarType, intent: MotionIntentVector): string {
    if (intent.instability > 0.6) return 'chaotic_handheld'
    if (intent.instability > 0.3) return 'gentle_handheld'
    if (intent.pressure > 0.6) return 'pressured_tracking'
    if (intent.intimacy > 0.6) return 'intimate_close'
    if (intent.energyFlow > 0.5) return 'dynamic_thrust'
    if (intent.energyFlow < -0.5) return 'calm_retreat'
    if (type === 'establishing') return 'static_observant'
    return 'neutral_stable'
  }

  /**
   * 推断叙事效果描述
   */
  private inferNarrativeEffect(type: ShotGrammarType, intent: MotionIntentVector): string {
    switch (type) {
      case 'establishing':
        return `沉着展示场景空间，${intent.pressure > 0.3 ? '暗含不安' : '平和开场'}`

      case 'build_up':
        if (intent.energyFlow > 0.5) return `逐步推近，压迫感渐强，观众感受到即将到来的冲突`
        if (intent.intimacy > 0.5) return `缓缓靠近角色，悄悄进入角色的内心世界`
        return `镜头平稳跟随，叙事在推进`

      case 'peak':
        if (intent.instability > 0.6) return `剧烈晃动，混乱感达到顶点，观众的紧张完全被调动`
        return `镜头收紧，爆发力达到最大`

      case 'release':
        return `缓缓退出，让观众喘口气，情绪逐渐平复`

      case 'reaction':
        return `轻轻聚焦在角色面部，让观众看清情绪变化`

      case 'insert':
        return `静态展示关键细节，让观众注意到重要信息`

      case 'transition':
        return `缓慢过渡，为下一场景做准备`

      default:
        return `平稳拍摄`
    }
  }

  /**
   * 构建运动指令文本
   */
  private buildMotionDirective(style: string, intent: MotionIntentVector): string {
    const dir = intent.energyFlow > 0 ? '推近' : intent.energyFlow < -0.3 ? '退远' : '平移'
    const stability = intent.instability > 0.5 ? '手持晃动' : '稳定'
    const speed = intent.energyFlow > 0.5 ? '中快速' : intent.energyFlow < -0.5 ? '缓慢' : '中速'

    return `[motion:${style}] ${dir}, ${stability}, ${speed}`
  }
}
