/**
 * Temporal Prompt Injector
 * Temporal Consistency Engine — 时间连续性引擎
 *
 * 时间连续性注入器：将镜头链中的过渡信息注入视频 prompt。
 *
 * 注入策略：
 *   - 连续性高的镜头 → 不加额外约束（自然过渡）
 *   - 连续性低的镜头 → 注入显式过渡提示（避免跳变）
 *   - 所有镜头 + "scene continuity" 前缀（让视频模型理解前后关系）
 *
 * 输出格式兼容 CinematicCompiler 的 prompt 结构。
 */

import { ChainLink } from './scene-chain-builder'
import { CinematicShot } from '../cinematic-compiler/cinematic-dsl-schema'

export interface InjectedShot {
  /** 原始 CinematicShot */
  shot: CinematicShot
  /** 注入连续性后的 prompt */
  injectedPrompt: string
  /** 连续性分数 */
  continuityScore: number
  /** 是否注入了过渡提示 */
  hadTransitionHint: boolean
}

export class TemporalPromptInjector {
  /**
   * 为镜头链中的所有镜头注入过渡提示
   */
  inject(links: ChainLink[]): InjectedShot[] {
    return links.map((link, i) => {
      const hint = this.buildTransitionHint(link, i, links)
      const injectedPrompt = this.injectHint(link.shot, hint)

      return {
        shot: link.shot,
        injectedPrompt,
        continuityScore: link.continuityScore,
        hadTransitionHint: link.needsTransitionHint,
      }
    })
  }

  /**
   * 构建连续性提示文本
   */
  private buildTransitionHint(link: ChainLink, index: number, allLinks: ChainLink[]): string {
    const parts: string[] = []

    // 场景位置
    parts.push(`[shot_${index + 1}_of_${allLinks.length}]`)

    // 镜头编号和连续性信息
    if (index > 0) {
      if (link.needsTransitionHint) {
        // 低连续性：需要显式过渡提示
        const cameraHint = this.cameraTransitionHint(allLinks[index - 1], link)
        const lightingHint = this.lightingTransitionHint(allLinks[index - 1], link)
        const motionHint = this.motionTransitionHint(allLinks[index - 1], link)
        parts.push(`[continuity:${link.continuityScore.toFixed(2)}]`)
        if (cameraHint) parts.push(cameraHint)
        if (lightingHint) parts.push(lightingHint)
        if (motionHint) parts.push(motionHint)
      } else {
        // 高连续性：简单标注
        parts.push('[continuity:continuous]')
      }
    } else {
      // 第一个镜头
      parts.push('[continuity:establishing]')
    }

    return parts.join(' ')
  }

  /**
   * 将过渡提示注入到 shot prompt
   */
  private injectHint(shot: CinematicShot, hint: string): string {
    return `${hint}\n${shot.raw}`
  }

  /**
   * 摄像机过渡提示
   */
  private cameraTransitionHint(prev: ChainLink, curr: ChainLink): string {
    const focalDiff = Math.abs(
      prev.transitioned.camera.focalLength - curr.transitioned.camera.focalLength,
    )
    if (focalDiff > 40) {
      return `[camera:transition_zoom_${focalDiff > 80 ? 'dramatic' : 'smooth'}]`
    }
    if (prev.transitioned.camera.movementType !== curr.transitioned.camera.movementType) {
      return `[camera:movement_transition_${curr.transitioned.camera.movementType === 0 ? 'to_static' : 'to_dynamic'}]`
    }
    return ''
  }

  /**
   * 光照过渡提示
   */
  private lightingTransitionHint(prev: ChainLink, curr: ChainLink): string {
    const intensityDiff = Math.abs(
      prev.transitioned.lighting.intensity - curr.transitioned.lighting.intensity,
    )
    const tempDiff = Math.abs(
      prev.transitioned.lighting.colorTemperature - curr.transitioned.lighting.colorTemperature,
    )

    const hints: string[] = []
    if (intensityDiff > 0.3) hints.push(`light:${intensityDiff > 0.5 ? 'dramatic_shift' : 'gradual_transition'}`)
    if (tempDiff > 1500) hints.push(`color:temperature_transition`)

    return hints.length > 0 ? `[${hints.join(';')}]` : ''
  }

  /**
   * 运动过渡提示
   */
  private motionTransitionHint(prev: ChainLink, curr: ChainLink): string {
    const velDiff = Math.abs(
      prev.transitioned.motion.velocity - curr.transitioned.motion.velocity,
    )
    if (velDiff > 3) {
      return `[motion:${prev.transitioned.motion.velocity > curr.transitioned.motion.velocity ? 'decelerate' : 'accelerate'}]`
    }
    return ''
  }
}
