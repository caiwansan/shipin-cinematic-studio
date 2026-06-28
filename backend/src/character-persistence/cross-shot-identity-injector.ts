/**
 * Cross-Shot Identity Injector
 * Character Persistence System — 角色一致性系统
 *
 * 跨镜头身份注入器：将身份锁定指令注入到每个镜头的 prompt 中。
 *
 * 注入位置：
 *   - Scene Level: 场景建立时注入完整身份信息
 *   - Shot Level: 每个镜头注入身份锁定 token
 *   - Transition Level: 镜头过渡时附加身份不变提示
 *
 * 输出格式：与 CinematicCompiler + TemporalEngine 的 prompt 格式兼容
 */

import { CharacterIdentity } from './character-identity-graph'
import { IdentityLockEngine, LockToken } from './identity-lock-engine'

export interface IdentityInjectedShot {
  /** 原始自然语言描述 */
  rawDescription: string
  /** 注入身份锁定后的完整 prompt */
  injectedPrompt: string
  /** 注入的锁定维度 */
  injectedTokens: string[]
  /** 是否为场景建立镜头（注入更完整身份信息） */
  isEstablishing: boolean
}

export class CrossShotIdentityInjector {
  private lockEngine = new IdentityLockEngine()

  /**
   * 为单个镜头注入身份信息
   */
  injectShot(
    shotDescription: string,
    identity: CharacterIdentity,
    isEstablishing = false,
  ): IdentityInjectedShot {
    const tokens: LockToken[] = isEstablishing
      ? this.lockEngine.lockFull(identity) // 场景建立：全部维度
      : [this.lockEngine.lockOutfit(identity), this.lockEngine.lockBody(identity)] // 常规镜头：体态+着装

    const identityPrompt = tokens.map(t => t.promptHint).join('\n')

    const injectedPrompt = isEstablishing
      ? `[ESTABLISHING CHARACTER: ${identity.name}]\n${identityPrompt}\n\nAction: ${shotDescription}`
      : `${identityPrompt}\nSame character "${identity.name}" continues. Action: ${shotDescription}`

    return {
      rawDescription: shotDescription,
      injectedPrompt,
      injectedTokens: tokens.map(t => t.dimension),
      isEstablishing,
    }
  }

  /**
   * 为镜头序列注入身份信息
   * 第一个镜头做场景建立（full identity），后续只做体态+着装锁定
   */
  injectShots(
    shotDescriptions: string[],
    identity: CharacterIdentity,
  ): IdentityInjectedShot[] {
    return shotDescriptions.map((desc, i) =>
      this.injectShot(desc, identity, i === 0),
    )
  }

  /**
   * 生成场景切换时的身份提醒提示
   */
  generateSceneTransitionReminder(identity: CharacterIdentity): string {
    return `[SCENE TRANSITION — character "${identity.name}" persists with same identity, face, body and outfit]`
  }
}
