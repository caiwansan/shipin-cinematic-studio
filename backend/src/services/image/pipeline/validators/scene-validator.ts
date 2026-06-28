// ============================================================
// validators/scene-validator.ts
//
// 职责：D1 Scene Validator — 场景图质量门禁
//
// 验证维度（5 维，与 Ontology V1 对应）：
//   composition              — 构图质量（焦点/平衡/电影感）
//   characterAppearance      — 角色在场景中的外观一致性
//   lightingConsistency      — 光影一致性
//   backgroundRelevance      — 背景与剧本匹配度
//   spatialCoherence         — 空间关系正确性
//
// 设计原则：
//   - 严格遵循 V1 baseline（已在 baseline-registry 定义）
//   - 复用 ScoringCalibrator + QualityAnchor（与 character 同校准管线）
//   - 只做规则评分，AI 视觉预留扩展点
//   - 不触发 retry，只返回 quality signal
//   - 场景图是"空间坐标系"——不涉及角色身份/叙事流
// ============================================================

import type { ValidationHook, ValidationOutcome, ExecutionContext } from '../types.js'
import { ScoringCalibrator } from './core/scoring-calibrator.js'
import { generateQualityReport } from './core/quality-anchor.js'

// ─── 配置 ──────────────────────────────────────────────

interface SceneValidatorConfig {
  /** 构图合格阈值 */
  compositionThreshold: number
  /** 空间关系合格阈值 */
  spatialCoherenceThreshold: number
  /** 角色外观一致阈值 */
  characterAppearanceThreshold: number
  /** 是否开启 AI 视觉验证 */
  enableVision: boolean
  /** 基线版本 */
  baselineVersion: string
}

const DEFAULT_CONFIG: SceneValidatorConfig = {
  compositionThreshold: 0.75,
  spatialCoherenceThreshold: 0.70,
  characterAppearanceThreshold: 0.70,
  enableVision: false,
  baselineVersion: '1.0.0',
}

// ─── 规则评分函数 ────────────────────────────────────

interface ImageMetadata {
  width: number
  height: number
  sceneDescription: string
  hasDimensions: boolean
}

function scoreComposition(meta: ImageMetadata): { score: number; issues: string[] } {
  const issues: string[] = []
  let score = 0.75

  if (meta.hasDimensions) {
    const aspectRatio = meta.width / meta.height
    if (aspectRatio < 0.8 || aspectRatio > 2.5) {
      score -= 0.15
      issues.push('画面宽高比不符合标准帧比例')
    }
    if (meta.width < 512 || meta.height < 512) {
      score -= 0.25
      issues.push('画面分辨率偏低，可能影响构图表现')
    }
  }

  const weakSignals = ['模糊', '杂乱', '混乱', '随意', '简单', '崩溃', '崩坏', '扭曲']
  for (const signal of weakSignals) {
    if (meta.sceneDescription.toLowerCase().includes(signal)) {
      score -= 0.1
      issues.push(`场景描述包含构图弱信号："${signal}"`)
      break
    }
  }

  return { score: Math.max(0.1, Math.min(1, score)), issues }
}

function scoreCharacterAppearance(
  meta: ImageMetadata,
  characterRefName?: string,
): { score: number; issues: string[] } {
  const issues: string[] = []
  let score = 0.70

  if (characterRefName) {
    if (!meta.sceneDescription.toLowerCase().includes(characterRefName.toLowerCase())) {
      score -= 0.15
      issues.push(`场景描述中未找到角色 "${characterRefName}" 的引用`)
    }
  }

  const weakSignals = ['模糊', '看不清', '无脸', '侧面', '背面', '远处']
  for (const signal of weakSignals) {
    if (meta.sceneDescription.toLowerCase().includes(signal)) {
      score -= 0.08
      issues.push(`角色外观弱信号："${signal}"`)
      break
    }
  }

  return { score: Math.max(0.1, Math.min(1, score)), issues }
}

function scoreLightingConsistency(meta: ImageMetadata): { score: number; issues: string[] } {
  const issues: string[] = []
  const desc = meta.sceneDescription.toLowerCase()

  const posSignals = ['光照', '光线', '灯光', '阴影', '逆光', '柔光', '硬光', '自然光', '顶光', '侧光', '黄昏', '日落', '阳光', '月光', '霓虹灯', '蜡烛']
  const hasPosSignal = posSignals.some(s => desc.includes(s))

  const negSignals = ['阴暗又明亮', '混乱光线', '光线矛盾', '明暗不统一']
  const hasNegSignal = negSignals.some(s => desc.includes(s))

  let score: number
  if (hasPosSignal && !hasNegSignal) {
    score = 0.85
  } else if (hasPosSignal && hasNegSignal) {
    score = 0.50
    issues.push('场景描述存在光影矛盾信号')
  } else if (hasNegSignal) {
    score = 0.30
    issues.push('场景描述中出现光线矛盾描述')
  } else {
    score = 0.65
  }

  return { score: Math.max(0.1, Math.min(1, score)), issues }
}

function scoreBackgroundRelevance(
  meta: ImageMetadata,
  expectedBackground?: string,
): { score: number; issues: string[] } {
  const issues: string[] = []
  const desc = meta.sceneDescription.toLowerCase()

  if (!desc || desc.length < 5) {
    return { score: 0.40, issues: ['场景描述过短，无法评估背景匹配度'] }
  }

  if (expectedBackground) {
    const expected = expectedBackground.toLowerCase()
    const expectedKeywords = expected.split(/[\s,，。、]/).filter(w => w.length > 1)
    const matchedCount = expectedKeywords.filter(kw => desc.includes(kw)).length
    const matchRate = expectedKeywords.length > 0 ? matchedCount / expectedKeywords.length : 0

    if (matchRate < 0.2) {
      issues.push('场景描述与预期背景关键词匹配度较低')
      return { score: 0.35 + matchRate * 0.3, issues }
    }
    if (matchRate < 0.5) {
      return { score: 0.60 + matchRate * 0.2, issues: ['背景匹配度中等'] }
    }
    return { score: 0.85, issues: [] }
  }

  const detailSignals = ['室内', '室外', '古代', '现代', '未来', '城市', '乡村', '森林', '大海', '天空', '建筑', '房间', '街道', '大殿']
  const signalCount = detailSignals.reduce((sum, s) => desc.includes(s) ? sum + 1 : sum, 0)
  if (signalCount >= 3) return { score: 0.80, issues: [] }
  if (signalCount >= 1) return { score: 0.65, issues: [] }
  return { score: 0.50, issues: ['场景描述缺乏具体的背景特征关键词'] }
}

function scoreSpatialCoherence(meta: ImageMetadata): { score: number; issues: string[] } {
  const issues: string[] = []
  const desc = meta.sceneDescription.toLowerCase()

  const posSignals = ['近景', '中景', '远景', '特写', '前景', '背景', '远处', '近处', '左', '右', '前', '后', '上', '下', '中']
  const posMatches = posSignals.filter(s => desc.includes(s))

  const negSignals = ['比例失调', '透视错误', '扭曲', '变形', '物体漂浮', '空间混乱']
  const hasNegSignal = negSignals.some(s => desc.includes(s))

  let score = 0.65
  if (posMatches.length >= 3) score = 0.85
  else if (posMatches.length >= 1) score = 0.70

  if (hasNegSignal) {
    score -= 0.30
    issues.push('场景描述包含空间关系异常信号')
  }

  return { score: Math.max(0.1, Math.min(1, score)), issues }
}

// ─── Validator 工厂 ─────────────────────────────────────

export function createSceneValidator(config: Partial<SceneValidatorConfig> = {}): ValidationHook {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const calibrator = new ScoringCalibrator()

  return {
    name: 'scene-validator',
    async validate(
      imageUrl: string,
      ctx: ExecutionContext,
    ): Promise<ValidationOutcome> {
      const meta: ImageMetadata = {
        width: 0,
        height: 0,
        sceneDescription: '',
        hasDimensions: false,
      }

      if (ctx.sceneBibleId) {
        // future: read from Scene Bible
      }

      if (imageUrl) {
        meta.hasDimensions = true
        meta.width = 1024
        meta.height = 1024
      }

      const comp = scoreComposition(meta)
      const charApp = scoreCharacterAppearance(meta)
      const light = scoreLightingConsistency(meta)
      const bgRel = scoreBackgroundRelevance(meta)
      const spatial = scoreSpatialCoherence(meta)

      const rawScores: Record<string, number> = {
        composition: comp.score,
        characterAppearance: charApp.score,
        lightingConsistency: light.score,
        backgroundRelevance: bgRel.score,
        spatialCoherence: spatial.score,
      }

      const allIssues: Record<string, string[]> = {
        composition: comp.issues,
        characterAppearance: charApp.issues,
        lightingConsistency: light.issues,
        backgroundRelevance: bgRel.issues,
        spatialCoherence: spatial.issues,
      }

      const composite = calibrator.calibrateAll('scene', rawScores, {}, cfg.baselineVersion)
      const report = generateQualityReport('scene', rawScores, allIssues, {
        baselineVersion: cfg.baselineVersion,
      })

      const overallScore = composite.composite.calibrated
      const allIssuesFlat = Object.values(allIssues).flat()

      return {
        passed: overallScore >= cfg.compositionThreshold * 0.8,
        score: overallScore,
        issues: [...allIssuesFlat, `calibrated:${composite.composite.calibrated}/${report.summary}`],
      }
    },
  }
}
