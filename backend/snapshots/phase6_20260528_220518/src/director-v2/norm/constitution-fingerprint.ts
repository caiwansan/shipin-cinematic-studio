/**
 * constitution-fingerprint.ts — Constitution 指纹系统
 *
 * 为每个 StoryConstitution 生成不变的语义指纹。
 * 用于：漂移检测、宪法宇宙一致性验证、retry/resume 时的宪法身份确认。
 *
 * 指纹生成规则：
 *   fingerprint = sha256(core fields that define "this is the same story universe")
 *
 * 参与指纹的核心字段（any 的输入不参与指纹）：
 *   - coreTheme: 主题是宪法宇宙的根
 *   - cinematicIdentity.primaryInfluences: 风格影响源
 *   - visualDoctrine.colorDoctrine.primaryPalette: 色彩体系
 *   - visualDoctrine.lightingDoctrine.baseApproach: 灯光体系
 *   - worldPhysics.environmentType + timePeriod: 世界物理基础
 *   - characterLaws[].name + role: 角色骨架
 *
 * 不参与指纹的字段（这些是 runtime 状态，不影响宪法宇宙身份）：
 *   - createdAt, traceId, confidence, degraded
 *   - pacingDoctrine.beatMap（节奏细节可在宪法宇宙内调整）
 *   - emotionalTrajectory.segments（情绪细节可在宪法宇宙内调整）
 */

import { createHash } from 'node:crypto'
import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Fingerprint Input — 只包含宪法宇宙身份字段
// ============================================================

interface FingerprintInput {
  coreTheme: string
  primaryInfluences: string[]
  colorPalette: string[]
  lightingApproach: string
  environmentType: string
  timePeriod: string
  characterSkeleton: Array<{ name: string; role: string }>
}

// ============================================================
// Fingerprint Result
// ============================================================

export interface FingerprintResult {
  /** SHA-256 十六进制指纹 */
  hash: string

  /** 指纹的简短前缀（用于日志/显示） */
  shortHash: string

  /** 参与指纹的字段数量 */
  inputFieldCount: number
}

// ============================================================
// Fingerprint Engine
// ============================================================

/**
 * 从 StoryConstitution 提取指纹核心字段
 */
function extractFingerprintInput(constitution: StoryConstitution): FingerprintInput {
  return {
    coreTheme: constitution.coreTheme || 'default_theme',
    primaryInfluences: (constitution.cinematicIdentity?.primaryInfluences || []).sort(),
    colorPalette: (constitution.visualDoctrine?.colorDoctrine?.primaryPalette || []).sort(),
    lightingApproach: constitution.visualDoctrine?.lightingDoctrine?.baseApproach || 'natural',
    environmentType: constitution.worldPhysics?.environmentType || 'realistic',
    timePeriod: constitution.worldPhysics?.timePeriod || '当代',
    characterSkeleton: (constitution.characterLaws || [])
      .map(l => ({ name: l.name || 'unknown', role: l.role || 'supporting' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * 计算 Constitution 指纹
 */
export function calculateConstitutionFingerprint(constitution: StoryConstitution): FingerprintResult {
  const input = extractFingerprintInput(constitution)

  // 序列化为规范 JSON（key 排序保证一致性）
  const serialized = JSON.stringify(input, Object.keys(input).sort())

  const hash = createHash('sha256').update(serialized).digest('hex')

  return {
    hash,
    shortHash: hash.slice(0, 12),
    inputFieldCount: Object.keys(input).length + input.characterSkeleton.length,
  }
}

/**
 * 比较两个 Constitution 是否属于同一宪法宇宙
 *
 * 返回：
 *   identical: true  → 指纹完全相同，不出意外
 *   driftDetected: true → 指纹不同（跨宇宙漂移）
 *   similarity: 0-1 → 字段级别的相似度（用于趋势追踪）
 */
export function compareConstitutionFingerprints(
  a: StoryConstitution,
  b: StoryConstitution,
): { identical: boolean; driftDetected: boolean; similarity: number } {
  const fpA = calculateConstitutionFingerprint(a)
  const fpB = calculateConstitutionFingerprint(b)

  if (fpA.hash === fpB.hash) {
    return { identical: true, driftDetected: false, similarity: 1.0 }
  }

  // 计算字段级别相似度
  const inputA = extractFingerprintInput(a)
  const inputB = extractFingerprintInput(b)
  const totalFields = 6 // 6 个核心字段类别
  let matchCount = 0

  if (inputA.coreTheme === inputB.coreTheme) matchCount++
  if (JSON.stringify(inputA.primaryInfluences) === JSON.stringify(inputB.primaryInfluences)) matchCount++
  if (JSON.stringify(inputA.colorPalette) === JSON.stringify(inputB.colorPalette)) matchCount++
  if (inputA.lightingApproach === inputB.lightingApproach) matchCount++
  if (inputA.environmentType === inputB.environmentType) matchCount++
  if (inputA.timePeriod === inputB.timePeriod) matchCount++

  const similarity = matchCount / totalFields

  return {
    identical: false,
    driftDetected: similarity < 0.7,
    similarity,
  }
}
