/**
 * semantic-drift.ts — 语义漂移检测器
 *
 * 检测 Constitution 在不同轮次/不同上下文之间是否发生语义漂移。
 * 用于：重试后检查、跨会话一致性、review engine 的"这似乎不是同一个故事"检测。
 *
 * 漂移类型：
 *   - 主题漂移：coreTheme 变更
 *   - 风格漂移：visualDoctrine 主要元素变更
 *   - 角色漂移：characterLaws 骨架变更
 *   - 世界漂移：worldPhysics 基础变更
 */

import { compareConstitutionFingerprints, calculateConstitutionFingerprint } from '../norm/constitution-fingerprint.js'
import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Drift Report
// ============================================================

export interface DriftReport {
  /** 是否检测到漂移 */
  driftDetected: boolean

  /** 漂移严重程度 */
  severity: 'none' | 'minor' | 'major' | 'critical'

  /** 指纹比较结果 */
  fingerprintComparison: {
    identical: boolean
    similarity: number
  }

  /** 具体漂移项 */
  drifts: DriftItem[]

  /** 总置信度变化 */
  confidenceDelta: number
}

export interface DriftItem {
  /** 漂移维度 */
  dimension: DriftDimension

  /** 漂移描述 */
  description: string

  /** 旧值 */
  from: string

  /** 新值 */
  to: string

  /** 影响评分 */
  impact: number
}

export type DriftDimension =
  | 'theme'
  | 'style_influence'
  | 'color_system'
  | 'lighting'
  | 'environment'
  | 'time_period'
  | 'character_skeleton'
  | 'pacing_structure'

// ============================================================
// Drift Detector
// ============================================================

export class SemanticDriftDetector {
  /**
   * 检测两个 Constitution 之间的语义漂移
   */
  detect(original: StoryConstitution, current: StoryConstitution): DriftReport {
    const fingerprintResult = compareConstitutionFingerprints(original, current)
    const drifts: DriftItem[] = []

    // 主题漂移
    if (original.coreTheme !== current.coreTheme) {
      drifts.push({
        dimension: 'theme',
        description: '核心主题变更',
        from: original.coreTheme,
        to: current.coreTheme,
        impact: 1.0,
      })
    }

    // 风格影响源漂移
    const origInfluences = JSON.stringify([...original.cinematicIdentity.primaryInfluences].sort())
    const currInfluences = JSON.stringify([...current.cinematicIdentity.primaryInfluences].sort())
    if (origInfluences !== currInfluences) {
      drifts.push({
        dimension: 'style_influence',
        description: '风格影响源变化',
        from: original.cinematicIdentity.primaryInfluences.join(', '),
        to: current.cinematicIdentity.primaryInfluences.join(', '),
        impact: 0.6,
      })
    }

    // 色彩体系漂移
    const origPalette = JSON.stringify([...original.visualDoctrine.colorDoctrine.primaryPalette].sort())
    const currPalette = JSON.stringify([...current.visualDoctrine.colorDoctrine.primaryPalette].sort())
    if (origPalette !== currPalette) {
      drifts.push({
        dimension: 'color_system',
        description: '色彩体系变更',
        from: original.visualDoctrine.colorDoctrine.primaryPalette.join(', '),
        to: current.visualDoctrine.colorDoctrine.primaryPalette.join(', '),
        impact: 0.5,
      })
    }

    // 灯光体系漂移
    if (original.visualDoctrine.lightingDoctrine.baseApproach !== current.visualDoctrine.lightingDoctrine.baseApproach) {
      drifts.push({
        dimension: 'lighting',
        description: '灯光体系变更',
        from: original.visualDoctrine.lightingDoctrine.baseApproach,
        to: current.visualDoctrine.lightingDoctrine.baseApproach,
        impact: 0.5,
      })
    }

    // 环境类型漂移
    if (original.worldPhysics.environmentType !== current.worldPhysics.environmentType) {
      drifts.push({
        dimension: 'environment',
        description: '世界观环境类型变更',
        from: original.worldPhysics.environmentType,
        to: current.worldPhysics.environmentType,
        impact: 0.8,
      })
    }

    // 时代漂移
    if (original.worldPhysics.timePeriod !== current.worldPhysics.timePeriod) {
      drifts.push({
        dimension: 'time_period',
        description: '时代背景变更',
        from: original.worldPhysics.timePeriod,
        to: current.worldPhysics.timePeriod,
        impact: 0.7,
      })
    }

    // 角色骨架漂移
    const origChars = original.characterLaws.map(c => `${c.name}:${c.role}`).sort().join(',')
    const currChars = current.characterLaws.map(c => `${c.name}:${c.role}`).sort().join(',')
    if (origChars !== currChars) {
      drifts.push({
        dimension: 'character_skeleton',
        description: '角色骨架变更',
        from: original.characterLaws.map(c => c.name).join(', '),
        to: current.characterLaws.map(c => c.name).join(', '),
        impact: 0.9,
      })
    }

    // 节奏结构漂移
    if (original.pacingDoctrine.structureType !== current.pacingDoctrine.structureType) {
      drifts.push({
        dimension: 'pacing_structure',
        description: '叙事结构变更',
        from: original.pacingDoctrine.structureType,
        to: current.pacingDoctrine.structureType,
        impact: 0.4,
      })
    }

    // 计算严重程度
    const severity = this.calculateSeverity(drifts, fingerprintResult.similarity)

    // 置信度变化
    const confidenceDelta = current.confidence - original.confidence

    return {
      driftDetected: drifts.length > 0,
      severity,
      fingerprintComparison: fingerprintResult,
      drifts,
      confidenceDelta,
    }
  }

  /**
   * 计算漂移严重程度
   */
  private calculateSeverity(
    drifts: DriftItem[],
    similarity: number,
  ): 'none' | 'minor' | 'major' | 'critical' {
    if (drifts.length === 0) return 'none'

    // 检查是否存在高影响漂移
    const hasHighImpact = drifts.some(d => d.impact >= 0.8)
    const hasMediumImpact = drifts.some(d => d.impact >= 0.5)

    if (hasHighImpact && similarity < 0.5) return 'critical'
    if (hasHighImpact) return 'major'
    if (hasMediumImpact && drifts.length >= 2) return 'major'
    if (hasMediumImpact) return 'minor'
    return 'minor'
  }
}

/** 全局单例 */
export const semanticDriftDetector = new SemanticDriftDetector()
