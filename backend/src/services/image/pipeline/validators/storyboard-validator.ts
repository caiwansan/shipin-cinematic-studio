// ============================================================
// validators/storyboard-validator.ts
//
// 职责：D1 Storyboard Validator — 分镜图轻量骨架版
//
// 设计原则（D4 Shadow 模式下）：
//   - 只做结构检查，不做评分闭环
//   - 不接 calibrator（不生成校准分数）
//   - 只输出结构 valid 信号 + 问题列表
//   - 不做 soft-loss / decision override
//   - 为 D4 提供 "分镜质量结构" 参考信号
//
// 验证维度（3 维，非完整 5 维）：
//   1. shot continuity    — 相邻帧之间镜头连贯性（景别/角度变化是否合理）
//   2. frame composition   — 单帧画面构图基本合理
//   3. narrative flow      — 基本叙事流是否可理解（不评分）
//
// 不做：
//   - ✗ full calibration
//   - ✗ soft-loss estimation
//   - ✗ decision override
//   - ✗ ontology mapping
// ============================================================

import type { ValidationHook, ValidationOutcome, ExecutionContext } from '../types.js'

// ─── 分镜帧描述 ────────────────────────────────────────

export interface StoryboardFrame {
  index: number
  shot: 'close-up' | 'mid-shot' | 'wide-shot' | 'extreme-wide' | 'unknown'
  angle: 'eye-level' | 'high-angle' | 'low-angle' | 'birds-eye' | 'dutch-angle' | 'unknown'
  description: string
}

// ─── 配置 ──────────────────────────────────────────────

interface StoryboardValidatorConfig {
  allowExtremeShotJump: boolean
  allowExtremeAngleJump: boolean
}

const DEFAULT_CONFIG: StoryboardValidatorConfig = {
  allowExtremeShotJump: false,
  allowExtremeAngleJump: false,
}

// ─── 镜头连贯性检查 ───────────────────────────────────

function checkShotContinuity(
  frames: StoryboardFrame[],
  config: StoryboardValidatorConfig,
): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  if (frames.length < 2) {
    return { valid: true, issues: [] }
  }

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]
    const curr = frames[i]

    const shotHierarchy = ['close-up', 'mid-shot', 'wide-shot', 'extreme-wide']
    const prevIdx = shotHierarchy.indexOf(prev.shot)
    const currIdx = shotHierarchy.indexOf(curr.shot)
    if (prevIdx !== -1 && currIdx !== -1) {
      const gap = Math.abs(prevIdx - currIdx)
      if (gap >= 3 && !config.allowExtremeShotJump) {
        issues.push(`帧 ${i - 1}→${i}：景别从 ${prev.shot} 跳到 ${curr.shot}，跨度过大`)
      } else if (prev.shot === curr.shot && gap === 0) {
        issues.push(`帧 ${i - 1}→${i}：景别未变化 (${prev.shot})，建议加入景别变化`)
      }
    }

    const anglePairs: [string, string][] = [
      ['birds-eye', 'low-angle'],
      ['high-angle', 'low-angle'],
      ['dutch-angle', 'eye-level'],
    ]
    for (const [a1, a2] of anglePairs) {
      if ((prev.angle === a1 && curr.angle === a2) || (prev.angle === a2 && curr.angle === a1)) {
        issues.push(`帧 ${i - 1}→${i}：角度从 ${prev.angle} 切换到 ${curr.angle}，视觉跳跃感强`)
      }
    }
  }

  return { valid: issues.length <= Math.ceil(frames.length / 2), issues }
}

// ─── 帧构图检查（轻量） ───────────────────────────────

function checkFrameComposition(frames: StoryboardFrame[]): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  for (const frame of frames) {
    const desc = frame.description.toLowerCase()

    const layoutSignals = ['前景', '背景', '左', '右', '中', '远处', '近处', '特写', '全景']
    const hasLayout = layoutSignals.some(s => desc.includes(s))

    if (!hasLayout && frame.shot !== 'unknown') {
      issues.push(`帧 ${frame.index}（${frame.shot}）：画面描述缺乏空间布局指引`)
    }

    const negSignals = ['模糊', '崩坏', '扭曲', '无法看清', '混乱']
    for (const signal of negSignals) {
      if (desc.includes(signal)) {
        issues.push(`帧 ${frame.index}：画面质量异常信号 "${signal}"`)
        break
      }
    }
  }

  return { valid: issues.length <= Math.ceil(frames.length / 2), issues }
}

// ─── 叙事流检查（轻量，不评分） ──────────────────────

function checkNarrativeFlow(frames: StoryboardFrame[]): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  if (frames.length < 2) {
    return { valid: true, issues: [] }
  }

  let hasActionEvent = false
  for (const frame of frames) {
    const desc = frame.description.toLowerCase()
    const actionVerbs = ['走', '跑', '跳', '说', '看', '拿', '放', '坐', '站', '举', '拉', '推', '打', '抱', '递', '接', '转身', '抬头', '低头', '开口', '闭眼', '看向', '指']
    if (actionVerbs.some(v => desc.includes(v))) {
      hasActionEvent = true
      break
    }
  }

  if (!hasActionEvent) {
    issues.push('全部分镜帧都未检测到动作描述，叙事流可能过于静态')
  }

  return { valid: issues.length <= 1, issues }
}

// ─── Validator 工厂 ─────────────────────────────────────

export function createStoryboardValidator(
  config: Partial<StoryboardValidatorConfig> = {},
): ValidationHook {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  return {
    name: 'storyboard-validator',
    async validate(
      imageUrl: string,
      ctx: ExecutionContext,
    ): Promise<ValidationOutcome> {
      const frames: StoryboardFrame[] = []

      const shotCheck = checkShotContinuity(frames, cfg)
      const compCheck = checkFrameComposition(frames)
      const narrativeCheck = checkNarrativeFlow(frames)

      const allIssues = [
        ...shotCheck.issues,
        ...compCheck.issues,
        ...narrativeCheck.issues,
      ]

      const score = frames.length > 0
        ? Math.max(0.3, 1 - allIssues.length * 0.08)
        : 1

      return {
        passed: shotCheck.valid && compCheck.valid && narrativeCheck.valid,
        score,
        issues: [
          ...allIssues,
          `shot=${shotCheck.valid} comp=${compCheck.valid} flow=${narrativeCheck.valid}`,
        ],
      }
    },
  }
}
