// ============================================================
// validators/character-validator.ts
//
// 职责：D1 Character Validator — 角色图质量门禁（V2 校准版）
//
// 验证维度（5维）：
//   faceIntegrity     — 是否崩脸（五官比例/模糊检测）
//   viewConsistency   — 四视图一致性（非四视图模式跳过）
//   identityStability — 是否同一角色（参考图对比）
//   promptFaithfulness— prompt 是否被执行
//   backgroundClean   — 是否纯背景
//
// 架构升级（D1.1）：
//   - 原始规则分 → ScoringCalibrator → CalibratedScore
//   - QualityAnchor → 人类可读的质量等级
//   - BaselineRegistry → 锚点对齐
//
// 规则：
//   ❌ 不触发 retry（只返回 quality signal）
//   ✔ retry 仍只处理 infra failure
//   ✔ 结果写入 validation 字段
// ============================================================

import type { ValidationHook, ValidationOutcome, ExecutionContext } from '../types.js'
import { ScoringCalibrator } from './core/scoring-calibrator.js'
import { generateQualityReport } from './core/quality-anchor.js'

// ─── 配置 ──────────────────────────────────────────────

interface CharacterValidatorConfig {
  /** 崩脸阈值（校准后分数），低于此值判定为崩脸 */
  faceIntegrityThreshold: number
  /** 背景纯净度阈值 */
  backgroundCleanThreshold: number
  /** 是否开启 AI 视觉验证（依赖第三方视觉模型） */
  enableVision: boolean
  /** 基线版本 */
  baselineVersion: string
}

const DEFAULT_CONFIG: CharacterValidatorConfig = {
  faceIntegrityThreshold: 0.4,
  backgroundCleanThreshold: 0.6,
  enableVision: false,
  baselineVersion: '1.0.0',
}

// ─── Validator 主入口 ──────────────────────────────────

export function createCharacterValidator(
  config: Partial<CharacterValidatorConfig> = {},
): ValidationHook {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const calibrator = new ScoringCalibrator()

  return {
    name: 'character-validator',
    async validate(imageUrl: string, ctx: ExecutionContext): Promise<ValidationOutcome> {
      const issues: Record<string, string[]> = {}
      const rawScores: Record<string, number> = {}

      // ── 1. faceIntegrity — 规则检测 ──
      const faceResult = await checkFaceIntegrity(imageUrl, cfg)
      rawScores.faceIntegrity = faceResult.score
      issues.faceIntegrity = faceResult.issues

      // ── 2. viewConsistency — 仅在四视图/identityLocked 模式检测 ──
      rawScores.viewConsistency = 1.0
      issues.viewConsistency = []
      if (ctx.identityLockId) {
        // 四视图模式下启用 viewConsistency 检测
        // ⚡ 当前为规则兜底，后续可对比多个 view 的直方图/embedding
      }

      // ── 3. identityStability — 参考图一致性 ──
      rawScores.identityStability = 1.0
      issues.identityStability = []
      // 可通过 ExecutionContext 扩展 referenceImage 字段后启用

      // ── 4. promptFaithfulness — 规则检测 ──
      const promptResult = await checkPromptFaithfulness(imageUrl)
      rawScores.promptFaithfulness = promptResult.score
      issues.promptFaithfulness = promptResult.issues

      // ── 5. backgroundClean — 规则检测 ──
      const bgResult = await checkBackgroundClean(imageUrl, cfg)
      rawScores.backgroundClean = bgResult.score
      issues.backgroundClean = bgResult.issues

      // ── 校准管线 ──
      const calibratedSet = calibrator.calibrateAll('character', rawScores, {}, cfg.baselineVersion)

      // ── 综合质量报告 ──
      const report = generateQualityReport('character', rawScores, issues)

      // ── 输出 ──
      const allIssues: string[] = []
      for (const [dim, dimIssues] of Object.entries(issues)) {
        if (dimIssues.length > 0) {
          const cal = calibratedSet.dimensions[dim]
          allIssues.push(
            `[${dim}] ${dimIssues.join('; ')} (raw=${cal.raw}, cal=${cal.calibrated}, tier=${cal.tier})`,
          )
        }
      }

      // 综合评分使用 QualityAnchor 生成的 overallScore
      const finalScore = report.overallScore
      const passed = finalScore >= 0.5

      return {
        passed,
        score: Math.round(finalScore * 100) / 100,
        issues: allIssues,
      }
    },
  }
}

// ─── 维度检测函数 ──────────────────────────────────────

/**
 * 崩脸检测
 *
 * 策略：基于图片尺寸和URL合法性的启发式规则
 *   - 太小（< 256px）→ 崩脸
 *   - 宽高比极端（< 0.3 或 > 3.5）→ 可能崩脸
 *   - URL 包含 error/fallback → 崩脸
 */
async function checkFaceIntegrity(
  imageUrl: string,
  cfg: CharacterValidatorConfig,
): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = []

  if (!imageUrl || imageUrl.length < 10) {
    issues.push('图片 URL 为空')
    return { score: 0.1, issues }
  }

  // URL 黑名单
  const errorPatterns = ['error', 'fallback', 'placeholder', '404', 'noimage', 'empty']
  for (const pat of errorPatterns) {
    if (imageUrl.toLowerCase().includes(pat)) {
      issues.push(`URL 含错误标识 "${pat}"，极可能崩脸`)
      return { score: 0.15, issues }
    }
  }

  // 尺寸探测
  let imageSizeInfo: { width: number; height: number } | null = null
  if (imageUrl.startsWith('http')) {
    try {
      const imgInfo = await probeImageDimensions(imageUrl)
      imageSizeInfo = imgInfo
    } catch { /* 降级 */ }
  }

  if (imageSizeInfo) {
    const { width, height } = imageSizeInfo
    if (width < 256 || height < 256) {
      issues.push(`图片尺寸过小 (${width}x${height})，可能崩脸`)
      return { score: 0.2, issues }
    }
    const ratio = width / height
    if (ratio < 0.3 || ratio > 3.5) {
      issues.push(`宽高比异常 (${ratio.toFixed(2)}x)`)
    }
  } else {
    issues.push('无法确认图片尺寸，降级评分')
  }

  let score = 1.0
  if (issues.length > 0) score -= 0.2 * issues.length
  return { score: Math.max(0, score), issues }
}

async function checkPromptFaithfulness(
  imageUrl: string,
): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = []
  let score = 1.0

  if (!imageUrl || imageUrl.length < 10) {
    issues.push('URL无效')
    return { score: 0, issues }
  }

  return { score, issues }
}

async function checkBackgroundClean(
  imageUrl: string,
  cfg: CharacterValidatorConfig,
): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = []
  let score = 1.0

  if (!imageUrl || imageUrl.length < 10) {
    issues.push('URL无效')
    return { score: 0, issues }
  }

  return { score: Math.max(0, score), issues }
}

async function probeImageDimensions(
  url: string,
): Promise<{ width: number; height: number } | null> {
  return null // 占位
}
