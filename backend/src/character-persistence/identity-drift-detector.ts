/**
 * Identity Drift Detector
 * Character Persistence System — 角色一致性系统
 *
 * 身份漂移检测器：检测同一个角色在跨镜头时是否出现"身份漂移"。
 *
 * 漂移检测维度：
 *   1. Face Drift — 面部描述是否变化（关键词一致性检查）
 *   2. Outfit Drift — 着装是否变化
 *   3. Body Drift — 体态是否变化
 *   4. Temporal Drift — 时间连续性（相邻镜头差异）
 *
 * 当前实现基于关键词文本分析（无需 embedding 模型）。
 * 未来可接入真实面部 embedding 进行数值化检测。
 */

import { CharacterIdentity } from './character-identity-graph'

export interface DriftReport {
  /** 是否稳定 */
  isStable: boolean
  /** 各维度漂移分数（0~1，0=无漂移，1=完全漂移） */
  scores: {
    face: number
    outfit: number
    body: number
    temporal: number
  }
  /** 综合漂移分数 */
  overall: number
  /** 漂移详情 */
  details: string[]
}

export class IdentityDriftDetector {
  /**
   * 检测前后两个镜头描述中同一角色的漂移程度
   */
  detect(
    prevDescription: string,
    currDescription: string,
    identity: CharacterIdentity,
  ): DriftReport {
    const prev = prevDescription.toLowerCase()
    const curr = currDescription.toLowerCase()

    const faceScore = this.detectFaceDrift(prev, curr, identity)
    const outfitScore = this.detectOutfitDrift(prev, curr, identity)
    const bodyScore = this.detectBodyDrift(prev, curr, identity)
    const temporalScore = this.detectTemporalDrift(prev, curr)

    const overall = (faceScore * 0.4 + outfitScore * 0.3 + bodyScore * 0.2 + temporalScore * 0.1)
    const isStable = overall < 0.3

    const details: string[] = []
    if (faceScore > 0.3) details.push(`⚠️ 面部描述差异: ${(faceScore * 100).toFixed(0)}%`)
    if (outfitScore > 0.3) details.push(`⚠️ 着装描述差异: ${(outfitScore * 100).toFixed(0)}%`)
    if (bodyScore > 0.3) details.push(`⚠️ 体态描述差异: ${(bodyScore * 100).toFixed(0)}%`)
    if (temporalScore > 0.3) details.push(`⚠️ 时间连续性: 镜头描述结构变化 ${(temporalScore * 100).toFixed(0)}%`)

    return { isStable, scores: { face: faceScore, outfit: outfitScore, body: bodyScore, temporal: temporalScore }, overall, details }
  }

  /**
   * 检测面部漂移：当前描述中 identity 的面部关键词是否仍然存在
   */
  private detectFaceDrift(prev: string, curr: string, identity: CharacterIdentity): number {
    const keywords = [
      ...identity.facialSignature.features.map(f => f.toLowerCase()),
      identity.facialSignature.ethnicity.toLowerCase(),
      identity.facialSignature.age.toLowerCase(),
    ]

    // 如果前后都没有面部描述，不视为漂移
    const prevHasDiscernibleFace = keywords.some(k => prev.includes(k))
    const currHasDiscernibleFace = keywords.some(k => curr.includes(k))

    if (!prevHasDiscernibleFace && !currHasDiscernibleFace) return 0
    if (prevHasDiscernibleFace && !currHasDiscernibleFace) return 0.7

    const matchedInCurr = keywords.filter(k => curr.includes(k)).length
    const ratio = matchedInCurr / keywords.length
    return 1 - ratio
  }

  /**
   * 检测着装漂移：当前描述中 identity 的着装关键词是否仍然存在
   */
  private detectOutfitDrift(prev: string, curr: string, identity: CharacterIdentity): number {
    const keywords = [
      ...identity.outfitSchema.colorPalette.map(c => c.toLowerCase()),
      ...identity.outfitSchema.accessories.map(a => a.toLowerCase()),
      identity.outfitSchema.baseClothing.toLowerCase(),
      identity.outfitSchema.style.toLowerCase(),
    ]

    if (keywords.length === 0) return 0

    const matchedInCurr = keywords.filter(k => curr.includes(k)).length
    const ratio = matchedInCurr / keywords.length
    return 1 - ratio
  }

  /**
   * 检测体态漂移
   */
  private detectBodyDrift(prev: string, curr: string, identity: CharacterIdentity): number {
    const keywords = [
      identity.bodySignature.height,
      identity.bodySignature.build,
      identity.bodySignature.postureBias,
      identity.bodySignature.signatureMannerism.toLowerCase(),
    ]

    const matchedInCurr = keywords.filter(k => curr.includes(k)).length
    const ratio = matchedInCurr / keywords.length
    return 1 - ratio
  }

  /**
   * 检测时间连续性：镜头描述的结构变化程度
   */
  private detectTemporalDrift(prev: string, curr: string): number {
    const prevWords = new Set(prev.split(/\s+/))
    const currWords = new Set(curr.split(/\s+/))
    const intersection = [...prevWords].filter(w => currWords.has(w)).length
    const union = new Set([...prevWords, ...currWords]).size
    if (union === 0) return 0
    return 1 - intersection / union
  }
}
