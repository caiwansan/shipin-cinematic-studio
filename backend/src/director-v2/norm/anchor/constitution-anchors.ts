/**
 * constitution-anchors.ts — Constitution 锚定系统
 *
 * 用于 Self-Stabilizing Constitution：第一次 compile 后提取"锚"，
 * 后续 compile 在 prompt 中注入这些锚，强制 LLM 收敛。
 *
 * 这是解决"同一剧本生成不同宪法宇宙"问题的核心机制。
 *
 * 锚定原理：
 *   核心锚（必须锁定）：
 *     - coreTheme: 主题
 *     - cinematicIdentity.primaryInfluences: 风格影响源
 *     - worldPhysics.environmentType: 世界观
 *   边缘锚（建议锁定）：visualDoctrine + pacingDoctrine 框架
 */

import { calculateConstitutionFingerprint, compareConstitutionFingerprints } from '../constitution-fingerprint.js'
import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Constitution Anchor
// ============================================================

export interface ConstitutionAnchors {
  /** 核心主题锚 */
  coreTheme: string

  /** 情绪轨迹锚（只锁 shape，不锁细节） */
  emotionalArcType: string
  dominantEmotion: string

  /** 视觉教义锚 */
  visualDoctrineAnchors: {
    colorSymbolism: Record<string, string>
    temperatureBias: string
    baseApproach: string
    defaultComposition: string
    depthBias: string
  }

  /** 节奏教义锚 */
  pacingAnchors: {
    structureType: string
    pacingCurve: string
    hookDensity: string
  }

  /** 世界观锚 */
  worldAnchors: {
    environmentType: string
    timePeriod: string
    scale: string
  }

  /** 角色骨架锚（只锁角色存在，不锁细节） */
  characterSkeleton: Array<{ characterId: string; name: string; role: string }>

  /** 指纹快照 */
  fingerprint: string
  shortFingerprint: string
}

// ============================================================
// Anchor Extractor
// ============================================================

export function extractAnchors(constitution: StoryConstitution): ConstitutionAnchors {
  const fingerprint = calculateConstitutionFingerprint(constitution)

  return {
    coreTheme: constitution.coreTheme,
    emotionalArcType: constitution.emotionalTrajectory.arcType,
    dominantEmotion: constitution.emotionalTrajectory.dominantEmotion,
    visualDoctrineAnchors: {
      colorSymbolism: constitution.visualDoctrine.colorDoctrine.colorSymbolism,
      temperatureBias: constitution.visualDoctrine.colorDoctrine.temperatureBias,
      baseApproach: constitution.visualDoctrine.lightingDoctrine.baseApproach,
      defaultComposition: constitution.visualDoctrine.compositionDoctrine.defaultComposition,
      depthBias: constitution.visualDoctrine.compositionDoctrine.depthBias,
    },
    pacingAnchors: {
      structureType: constitution.pacingDoctrine.structureType,
      pacingCurve: constitution.pacingDoctrine.pacingCurve,
      hookDensity: constitution.pacingDoctrine.hookDensity,
    },
    worldAnchors: {
      environmentType: constitution.worldPhysics.environmentType,
      timePeriod: constitution.worldPhysics.timePeriod,
      scale: constitution.worldPhysics.scale,
    },
    characterSkeleton: constitution.characterLaws.map(l => ({
      characterId: l.characterId,
      name: l.name,
      role: l.role,
    })),
    fingerprint: fingerprint.hash,
    shortFingerprint: fingerprint.shortHash,
  }
}

// ============================================================
// Anchor-Anchored Compile Prompt Builder
// ============================================================

/**
 * 生成带有锚定约束的 System Prompt
 *
 * 注入逻辑：
 * - 核心锚用 MUST 级别强制
 * - 边缘锚用 SHOULD 级别建议
 * - 列表类型只插入存在信息，不插入枚举限制
 */
export function buildAnchoredSystemPrompt(basePrompt: string, anchors: ConstitutionAnchors): string {
  return `${basePrompt}

=== CONSTITUTION ANCHORS (必须遵守) ===

你必须在本次输出中严格保持以下宪法锚定：

【核心主题锚 — MUST】
- 核心主题: "${anchors.coreTheme}"
- 主导情绪: "${anchors.dominantEmotion}"
- 情感弧线类型: "${anchors.emotionalArcType}"

【视觉教义锚 — MUST】
- 色彩温度偏向: ${anchors.visualDoctrineAnchors.temperatureBias}
- 灯光基础手法: ${anchors.visualDoctrineAnchors.baseApproach}
- 默认构图: ${anchors.visualDoctrineAnchors.defaultComposition}
- 景深偏向: ${anchors.visualDoctrineAnchors.depthBias}
- 色彩象征: 必须保持已有映射，允许增加不冲突的映射

【节奏教义锚 — MUST】
- 叙事结构: ${anchors.pacingAnchors.structureType}
- 节奏曲线: ${anchors.pacingAnchors.pacingCurve}
- 钩子密度: ${anchors.pacingAnchors.hookDensity}

【世界观锚 — MUST】
- 环境类型: ${anchors.worldAnchors.environmentType}
- 时代背景: ${anchors.worldAnchors.timePeriod}
- 叙事规模: ${anchors.worldAnchors.scale}

【角色骨架锚 — MUST】
以下角色必须在 constitution 中完整保留（可增加不可减少）:
${anchors.characterSkeleton.map(c => `  - ${c.name} (${c.role})`).join('\n')}

【视觉细节 — SHOULD】
- 节拍图的细节长度和强度范围可以根据剧本调整
- 情绪分段的 intensity 值可微调
- 色彩主调色板可在保持温度偏好的前提下调整

以上锚定优先于一般分析偏好。`
}

// ============================================================
// Anchor Compliance Check
// ============================================================

export interface AnchorComplianceReport {
  compliant: boolean
  anchorFingerprintMatch: boolean
  violations: AnchorViolation[]
  totalAnchors: number
  violatedCount: number
  complianceRate: number
}

export interface AnchorViolation {
  anchorPath: string
  expected: string
  actual: string
  severity: 'MUST' | 'SHOULD'
}

/**
 * 检查新的 Constitution 是否遵守锚定
 */
export function checkAnchorCompliance(
  constitution: StoryConstitution,
  anchors: ConstitutionAnchors,
): AnchorComplianceReport {
  const violations: AnchorViolation[] = []

  // 指纹快速检查
  const fingerprintResult = compareConstitutionFingerprints(
    // 用指纹工厂重建一个锚对应的宪法指纹
    { ...constitution, coreTheme: anchors.coreTheme } as StoryConstitution,
    constitution,
  )
  const anchorFingerprintMatch = fingerprintResult.identical

  // 核心主题检查
  if (constitution.coreTheme !== anchors.coreTheme) {
    violations.push({
      anchorPath: 'coreTheme',
      expected: anchors.coreTheme,
      actual: constitution.coreTheme,
      severity: 'MUST',
    })
  }

  // 情绪轨迹检查
  if (constitution.emotionalTrajectory.arcType !== anchors.emotionalArcType) {
    violations.push({
      anchorPath: 'emotionalTrajectory.arcType',
      expected: anchors.emotionalArcType,
      actual: constitution.emotionalTrajectory.arcType,
      severity: 'MUST',
    })
  }

  // 灯光检查
  if (constitution.visualDoctrine.lightingDoctrine.baseApproach !== anchors.visualDoctrineAnchors.baseApproach) {
    violations.push({
      anchorPath: 'visualDoctrine.lightingDoctrine.baseApproach',
      expected: anchors.visualDoctrineAnchors.baseApproach,
      actual: constitution.visualDoctrine.lightingDoctrine.baseApproach,
      severity: 'MUST',
    })
  }

  // 叙事结构检查
  if (constitution.pacingDoctrine.structureType !== anchors.pacingAnchors.structureType) {
    violations.push({
      anchorPath: 'pacingDoctrine.structureType',
      expected: anchors.pacingAnchors.structureType,
      actual: constitution.pacingDoctrine.structureType,
      severity: 'MUST',
    })
  }

  // 世界观检查
  if (constitution.worldPhysics.environmentType !== anchors.worldAnchors.environmentType) {
    violations.push({
      anchorPath: 'worldPhysics.environmentType',
      expected: anchors.worldAnchors.environmentType,
      actual: constitution.worldPhysics.environmentType,
      severity: 'MUST',
    })
  }

  // 角色骨架检查（主角和反派必须存在）
  const originalRoles = new Set(anchors.characterSkeleton.map(c => `${c.name}:${c.role}`))
  const newRoles = new Set(constitution.characterLaws.map(l => `${l.name}:${l.role}`))
  for (const original of originalRoles) {
    if (!newRoles.has(original)) {
      violations.push({
        anchorPath: `characterLaws.${original}`,
        expected: original,
        actual: 'MISSING',
        severity: 'MUST',
      })
    }
  }

  const totalAnchors = 7 // 7 个 MUST 锚
  const mustViolations = violations.filter(v => v.severity === 'MUST').length

  return {
    compliant: mustViolations === 0,
    anchorFingerprintMatch,
    violations,
    totalAnchors,
    violatedCount: mustViolations,
    complianceRate: 1 - (mustViolations / totalAnchors),
  }
}
