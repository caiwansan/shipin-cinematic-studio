/**
 * Identity Stabilizer
 * Character Persistence System — 角色一致性系统
 *
 * 身份稳定器：当检测到身份漂移时，自动注入修复指令。
 *
 * 修复策略：
 *   - 轻度漂移（0.3~0.5）：附加身份提醒提示
 *   - 中度漂移（0.5~0.7）：替换当前描述中的身份关键词
 *   - 重度漂移（>0.7）：重建身份锁定，覆盖镜头描述
 *
 * 修复优先级：face > outfit > body（面部一致性最敏感）
 */

import { CharacterIdentity } from './character-identity-graph'
import { DriftReport } from './identity-drift-detector'
import { IdentityLockEngine } from './identity-lock-engine'

export interface StabilizationAction {
  /** 是否执行了修复 */
  didStabilize: boolean
  /** 修复后的 prompt */
  stabilizedPrompt: string
  /** 修复的动作列表 */
  actions: string[]
  /** 修复强度 */
  stabilityLevel: 'stable' | 'light_stabilized' | 'medium_stabilized' | 'heavy_stabilized'
}

export class IdentityStabilizer {
  private lockEngine = new IdentityLockEngine()

  /**
   * 稳定镜头中的角色身份
   */
  stabilize(
    shotDescription: string,
    identity: CharacterIdentity,
    driftReport: DriftReport,
  ): StabilizationAction {
    if (driftReport.isStable) {
      return {
        didStabilize: false,
        stabilizedPrompt: shotDescription,
        actions: [],
        stabilityLevel: 'stable',
      }
    }

    const actions: string[] = []
    const overall = driftReport.overall

    // 轻度修复：附加提醒
    if (overall >= 0.3 && overall < 0.5) {
      const hint = this.lockEngine.generateLockPrompt(identity)
      const fixed = `${shotDescription}\n\n[IDENTITY STABILIZATION: ${hint}]`
      actions.push('附加身份锁定提示')
      return { didStabilize: true, stabilizedPrompt: fixed, actions, stabilityLevel: 'light_stabilized' }
    }

    // 中度修复：替换 + 锁定
    if (overall >= 0.5 && overall < 0.7) {
      const faceLock = this.lockEngine.lockFace(identity)
      const outfitLock = this.lockEngine.lockOutfit(identity)
      const fixed = `${faceLock.promptHint}\n${outfitLock.promptHint}\n${shotDescription}`
      actions.push('注入面部锁定')
      actions.push('注入着装锁定')
      return { didStabilize: true, stabilizedPrompt: fixed, actions, stabilityLevel: 'medium_stabilized' }
    }

    // 重度修复：全重建
    const fullLock = this.lockEngine.generateLockPrompt(identity)
    const fixed = [
      `[IDENTITY RE-LOCK: ${identity.name}]`,
      fullLock,
      '',
      `Action: ${shotDescription}`,
      '',
      '[CRITICAL: This is the same character as previous shots — face, outfit, body MUST NOT change]',
    ].join('\n')
    actions.push('全面重建身份锁定')
    return { didStabilize: true, stabilizedPrompt: fixed, actions, stabilityLevel: 'heavy_stabilized' }
  }
}
