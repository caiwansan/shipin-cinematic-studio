/**
 * Director Review Engine
 *
 * 自动审片系统：
 * - 检查镜头问题（景别、构图、光线）
 * - 检查节奏问题（钩子密度、情绪曲线）
 * - 自动修正 prompt
 * - 自动标记需重生成的镜头
 */

import type { RhythmDesign } from './story-rhythm.agent.js'
import { continuityEngine, type ContinuityReport } from './continuity.engine.js'

// ============================================================
// Review Result
// ============================================================

export interface ReviewResult {
  passed: boolean
  score: number  // 0-100
  issues: ReviewIssue[]
  autoFixes: AutoFix[]
  shotsToRegenerate: string[]
  overallComment: string
}

export interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'suggestion'
  category: 'shot' | 'rhythm' | 'continuity' | 'prompt' | 'story'
  description: string
  fixSuggestion: string
  autoFixable: boolean
}

export interface AutoFix {
  issueIndex: number
  fixedPrompt: string
  fixType: 'add_detail' | 'adjust_tone' | 'fix_continuity' | 'add_camera_language'
}

// ============================================================
// Review Engine
// ============================================================

class DirectorReviewEngine {
  /**
   * 审片 — 分析已完成的所有镜头设计
   */
  async reviewShotPlan(
    shots: any[],
    rhythmDesign: RhythmDesign,
    continuityReport: ContinuityReport,
  ): Promise<ReviewResult> {
    const issues: ReviewIssue[] = []
    const autoFixes: AutoFix[] = []
    const shotsToRegenerate: string[] = []
    let score = 100

    // ============ 镜头级别检查 ============

    // 1. 检查每个镜头是否有完整的摄影语言
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]

      if (!shot.shotType || shot.shotType === 'medium') {
        issues.push({
          severity: 'minor',
          category: 'shot',
          description: `镜头 #${i + 1}: 使用默认景别，缺少设计意图`,
          fixSuggestion: '指定具体景别以增强视觉叙事',
          autoFixable: true,
        })
        score -= 3
      }

      if (!shot.cameraMotion || shot.cameraMotion === 'static') {
        issues.push({
          severity: 'suggestion',
          category: 'shot',
          description: `镜头 #${i + 1}: 无运镜设计`,
          fixSuggestion: '添加简单的运镜（pan/tilt/dolly）增强动感',
          autoFixable: true,
        })
        score -= 1
      }

      if (!shot.lighting || shot.lighting === 'natural') {
        issues.push({
          severity: 'minor',
          category: 'shot',
          description: `镜头 #${i + 1}: 灯光设计不具体`,
          fixSuggestion: '指定灯光风格（dramatic/low_key/high_key）',
          autoFixable: true,
        })
        score -= 2
      }

      // 自动修复：添加摄影语言
      if (autoFixes.length < 10) {
        let fixed = shot.description || ''
        if (!shot.shotType || shot.shotType === 'medium') {
          fixed = `[wide shot] ${fixed}`
        }
        if (shot.cameraMotion && shot.cameraMotion !== 'static') {
          fixed += `, camera ${shot.cameraMotion}`
        }
        if (shot.lighting && shot.lighting !== 'natural') {
          fixed += `, ${shot.lighting} lighting`
        }
        if (fixed !== shot.description) {
          autoFixes.push({
            issueIndex: i,
            fixedPrompt: fixed,
            fixType: 'add_camera_language',
          })
        }
      }
    }

    // ============ 节奏检查 ============

    if (rhythmDesign.hooks && rhythmDesign.hooks.length < 3) {
      issues.push({
        severity: 'major',
        category: 'rhythm',
        description: `钩子数量不足（${rhythmDesign.hooks.length}个），短剧需至少 3 个钩子`,
        fixSuggestion: '在 setup → tension → climax 各阶段添加钩子',
        autoFixable: false,
      })
      score -= 10
    }

    if (rhythmDesign.beats && rhythmDesign.beats.some(b => b.intensity < 3)) {
      issues.push({
        severity: 'minor',
        category: 'rhythm',
        description: '部分节拍强度偏低，可能导致观众流失',
        fixSuggestion: '增强低强度节拍的情绪张力',
        autoFixable: false,
      })
      score -= 5
    }

    const hasHighBeat = rhythmDesign.beats?.some(b => b.phase === 'climax' && b.intensity >= 8)
    if (!hasHighBeat) {
      issues.push({
        severity: 'critical',
        category: 'rhythm',
        description: '缺少高强度高潮节拍（intensity ≥ 8）',
        fixSuggestion: '重新设计高潮段落的情绪爆发',
        autoFixable: false,
      })
      score -= 15
    }

    // ============ 连续性检查 ============

    if (continuityReport.warnings.length > 3) {
      issues.push({
        severity: 'major',
        category: 'continuity',
        description: `连续性警告过多（${continuityReport.warnings.length}条）`,
        fixSuggestion: '检查角色特征一致性和场景光线连续性',
        autoFixable: true,
      })
      score -= 8
    }

    // 标记需要重生成的镜头
    if (issues.some(i => i.severity === 'critical')) {
      // 严重问题的镜头标记重生成
      shotsToRegenerate.push(...shots
        .filter(s => !s.shotType || s.shotType === 'medium')
        .map((_, i) => `shot_${i + 1}`))
    }

    return {
      passed: score >= 60,
      score: Math.max(0, Math.min(100, score)),
      issues,
      autoFixes,
      shotsToRegenerate,
      overallComment: score >= 80 ? '审片通过，质量良好'
        : score >= 60 ? '审片通过，需修复部分问题'
          : '审片未通过，需重新设计',
    }
  }

  /**
   * 自动修复 prompt
   */
  autoFixPrompt(original: string, issues: ReviewIssue[]): string {
    let fixed = original

    for (const issue of issues) {
      if (!issue.autoFixable) continue

      if (issue.category === 'shot') {
        if (!fixed.includes('cinematic')) {
          fixed = `Cinematic ${fixed}`
        }
        if (!fixed.includes('lighting') && issue.description.includes('灯光')) {
          fixed = `${fixed}, professional cinematic lighting`
        }
      }

      if (issue.category === 'continuity') {
        fixed = `${fixed}, consistent visual style`
      }
    }

    return fixed
  }
}

export const directorReviewEngine = new DirectorReviewEngine()
