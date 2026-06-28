/**
 * Identity Lock Engine
 * Character Persistence System — 角色一致性系统
 *
 * 身份锁定器：将角色身份数据转换为"身份锁定指令"。
 *
 * 锁定策略：
 *   - 三层锁定（face / body / outfit），每层独立注入
 *   - 每层锁定有锚定文本 + 约束强度
 *   - 约束强度调节（在高创造性场景降低约束）
 *
 * 核心逻辑：
 *   lock(identity) → LockToken[]（一组可注入的锁定指令）
 */

import { CharacterIdentity, characterIdentityToPromptSegment } from './character-identity-graph'

export interface LockToken {
  /** 锁定维度 */
  dimension: 'face' | 'body' | 'outfit' | 'full'
  /** 约束强度: 0~1 */
  strength: number
  /** 锁定提示片段 */
  promptHint: string
}

export class IdentityLockEngine {
  /**
   * 锁定全部维度
   */
  lockFull(identity: CharacterIdentity): LockToken[] {
    return [
      this.lockFace(identity),
      this.lockBody(identity),
      this.lockOutfit(identity),
    ]
  }

  /**
   * 锁定面部
   */
  lockFace(identity: CharacterIdentity): LockToken {
    const { ethnicity, age, features, portraitStyle } = identity.facialSignature
    return {
      dimension: 'face',
      strength: 0.9,
      promptHint: `IDENTITY_LOCK: face unchanged — ${ethnicity}, ${age}, ${features.join(', ')}. ${portraitStyle}. [MUST remain identical across all shots]`,
    }
  }

  /**
   * 锁定体态
   */
  lockBody(identity: CharacterIdentity): LockToken {
    const { height, build, postureBias, signatureMannerism } = identity.bodySignature
    return {
      dimension: 'body',
      strength: 0.7,
      promptHint: `BODY_LOCK: same person — ${height}, ${build} build, ${postureBias} posture. Mannerism: ${signatureMannerism}.`,
    }
  }

  /**
   * 锁定着装
   */
  lockOutfit(identity: CharacterIdentity): LockToken {
    const { baseClothing, colorPalette, accessories, style } = identity.outfitSchema
    const colors = colorPalette.join('/')
    const accStr = accessories.length > 0 ? `, wearing: ${accessories.join(', ')}` : ''
    return {
      dimension: 'outfit',
      strength: 0.8,
      promptHint: `OUTFIT_LOCK: consistent — ${baseClothing}, ${colors} palette, ${style} style${accStr}. [NO outfit changes between scenes]`,
    }
  }

  /**
   * 生成完整身份锁定 prompt
   * （供 CinematicCompiler/TemporalEngine 消费）
   */
  generateLockPrompt(identity: CharacterIdentity): string {
    return characterIdentityToPromptSegment(identity)
  }

  /**
   * 根据强度调节输出
   */
  lockWithStrength(identity: CharacterIdentity, strength: number): LockToken[] {
    const tokens = this.lockFull(identity)
    return tokens.map(t => ({
      ...t,
      strength: Math.min(t.strength, strength),
      promptHint: strength < 0.5
        ? t.promptHint.replace(/\[MUST/g, '[SUGGEST')
        : t.promptHint,
    }))
  }
}
