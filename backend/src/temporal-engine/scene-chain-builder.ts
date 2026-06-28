/**
 * Scene Chain Builder
 * Temporal Consistency Engine — 时间连续性引擎
 *
 * 镜头链构建器：将一组独立的 CinematicShot 链接为连续的时间序列。
 *
 * 构建流程：
 *   1. 每个 shot → TemporalState
 *   2. 相邻 shot → TransitionEngine 插值
 *   3. 生成 TransitionedChain（每个镜头附带过渡上下文）
 */

import { CinematicShot } from '../cinematic-compiler/cinematic-dsl-schema'
import {
  TemporalState,
  shotToTemporalState,
} from './temporal-state-model'
import {
  TemporalTransitionEngine,
  TransitionedState,
} from './temporal-transition-engine'

export interface ChainLink {
  /** 原始 shot 数据 */
  shot: CinematicShot
  /** 原始时间状态 */
  state: TemporalState
  /** 过渡后的状态 */
  transitioned: TransitionedState
  /** 与前一个镜头的连续性分数 */
  continuityScore: number
  /** 是否触发过渡提示 */
  needsTransitionHint: boolean
}

export interface SceneChain {
  /** 所有镜头链接 */
  links: ChainLink[]
  /** 平均连续性分数 */
  averageContinuity: number
  /** 需要过渡提示的镜头数 */
  transitionHintCount: number
}

export class SceneChainBuilder {
  private transitionEngine = new TemporalTransitionEngine()

  /**
   * 构建镜头链
   */
  build(shots: CinematicShot[], baseTimestamp = 0): SceneChain {
    const links: ChainLink[] = []
    let prevState: TemporalState | null = null

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]
      const timestamp = baseTimestamp + i * 2000 // 每个镜头 2s
      const state = shotToTemporalState(shot, `shot_${i + 1}`, timestamp)

      let transitioned: TransitionedState
      let continuityScore = 1
      let needsTransitionHint = false

      if (prevState) {
        transitioned = this.transitionEngine.transition(prevState, state)
        continuityScore = transitioned.continuityScore
        needsTransitionHint = this.transitionEngine.needsTransitionHint(continuityScore)
      } else {
        // 第一个镜头，无过渡
        transitioned = {
          camera: state.camera,
          lighting: state.lighting,
          motion: state.motion,
          continuityScore: 1,
        }
      }

      links.push({
        shot,
        state,
        transitioned,
        continuityScore,
        needsTransitionHint,
      })

      prevState = state
    }

    const averageContinuity = links.reduce((s, l) => s + l.continuityScore, 0) / links.length
    const transitionHintCount = links.filter(l => l.needsTransitionHint).length

    return { links, averageContinuity, transitionHintCount }
  }
}
