/**
 * COE — Patch Strategies
 *
 * 每类 Recommendation 对应一种 Patch Strategy。
 * 后续 Learning Memory 可驱动自定义策略。
 */

import type { PatchStrategy, PatchSection, PatchType, FieldPatch } from './coe-types.js'
import type { Recommendation } from './cee-types.js'

function patch(path: string, from: string | undefined, to: string | number | boolean): FieldPatch {
  return { path, from, to }
}

function section(type: PatchType, cap: string, fields: FieldPatch[], reason: string, expectedGain?: string, risk?: string, confidence = 0.85): PatchSection {
  return { type, confidence, targetCapability: cap, fields, reason, expectedGain, risk }
}

// ─── Scale Patch ──────────────────────────

export class ScalePatchStrategy implements PatchStrategy {
  name = 'ScalePatchStrategy'
  description = '调整景别（scale）以匹配期望的叙事尺度'
  handlesTypes = ['adjust']

  generate(rec: Recommendation): PatchSection[] {
    const results: PatchSection[] = []

    // 检查期望值
    if (rec.suggestedValue) {
      const path = rec.cirFieldPath || 'shots[0].camera.scale'
      results.push(section(
        rec.suggestedValue === 'close_up' || rec.suggestedValue === 'wide' ? 'experimental' : 'recommended',
        rec.capability,
        [patch(path, undefined, rec.suggestedValue)],
        rec.description,
        `${rec.capability} +10%`,
        '其他景别可能需要重新调整',
        rec.priority === 'high' ? 0.9 : 0.7,
      ))
    }

    return results
  }
}

// ─── Lighting Lock Patch ──────────────────

export class LightingLockPatchStrategy implements PatchStrategy {
  name = 'LightingLockPatchStrategy'
  description = '锁定灯光方向/色温以保持连续性'
  handlesTypes = ['add_constraint', 'toggle_capability']

  generate(rec: Recommendation): PatchSection[] {
    const results: PatchSection[] = []
    const shotPath = rec.cirFieldPath || 'shots[].lighting'

    // 所有镜头锁灯
    results.push(section(
      'safe',
      rec.capability,
      [
        patch(`${shotPath}.keyLightDirection`, undefined, 'left'),
        patch(`${shotPath}.colorTemperature`, undefined, 'warm'),
        patch(`${shotPath}.continuity`, undefined, true),
      ],
      rec.description || 'Lock lighting across all shots for continuity',
      `${rec.capability} +15-20%`,
      '轻微减少光照动态变化',
      0.94,
    ))

    return results
  }
}

// ─── Regen Patch ──────────────────────────

export class RegenPatchStrategy implements PatchStrategy {
  name = 'RegenPatchStrategy'
  description = '加入约束条件重新生成'
  handlesTypes = ['regen', 'add_constraint']

  generate(rec: Recommendation): PatchSection[] {
    const results: PatchSection[] = []

    if (rec.capability === 'OBJECT_PERSISTENCE') {
      results.push(section(
        'recommended',
        rec.capability,
        [
          patch('shots[].camera.focus.depthOfField', undefined, 'shallow'),
          patch('shots[].camera.focus.target', undefined, 'face'),
        ],
        rec.description || 'Use shallow DOF + explicit focus target for identity preservation',
        `${rec.capability} +10-15%`,
        '可能影响其它空间关系能力',
        0.8,
      ))
    } else {
      results.push(section(
        'experimental',
        rec.capability,
        [],
        rec.description || 'Regenerate with additional constraints',
        `${rec.capability} +15%`,
        '可能影响其他能力 -5-10%',
        0.6,
      ))
    }

    return results
  }
}

// ─── Composition Patch ────────────────────

export class CompositionPatchStrategy implements PatchStrategy {
  name = 'CompositionPatchStrategy'
  description = '调整构图规则'
  handlesTypes = ['adjust', 'add_constraint']

  generate(rec: Recommendation): PatchSection[] {
    const results: PatchSection[] = []
    const shotPath = rec.cirFieldPath || 'shots[0].camera.composition'

    results.push(section(
      'safe',
      rec.capability,
      [
        patch(`${shotPath}.rule`, undefined, 'rule_of_thirds'),
        patch(`${shotPath}.subjectPosition`, undefined, 'left_third'),
      ],
      rec.description || 'Apply rule of thirds with left-third subject position',
      `${rec.capability} +8-12%`,
      '无显著风险',
      0.9,
    ))

    return results
  }
}

// ─── Focus Patch ──────────────────────────

export class FocusPatchStrategy implements PatchStrategy {
  name = 'FocusPatchStrategy'
  description = '设置焦点控制'
  handlesTypes = ['add_constraint', 'toggle_capability']

  generate(rec: Recommendation): PatchSection[] {
    const results: PatchSection[] = []
    const path = rec.cirFieldPath || 'shots[0].camera.focus'

    results.push(section(
      'safe',
      rec.capability,
      [
        patch(`${path}.depthOfField`, undefined, rec.suggestedValue || 'shallow'),
        patch(`${path}.target`, undefined, 'subject_face'),
      ],
      rec.description || 'Set shallow DOF with explicit face focus',
      `${rec.capability} +12-18%`,
      '可能影响背景细节可见性',
      0.88,
    ))

    return results
  }
}

// ─── Motion Patch ─────────────────────────

export class MotionPatchStrategy implements PatchStrategy {
  name = 'MotionPatchStrategy'
  description = '控制镜头运动参数'
  handlesTypes = ['add_constraint']

  generate(rec: Recommendation): PatchSection[] {
    const results: PatchSection[] = []
    const path = rec.cirFieldPath || 'shots[0].camera.motion'

    results.push(section(
      'recommended',
      rec.capability,
      [
        patch(`${path}.pattern`, undefined, 'smooth_dolly'),
        patch('shots[0].camera.path.type', undefined, 'forward'),
      ],
      rec.description || 'Define camera path with smooth dolly-in',
      `${rec.capability} +15%`,
      '快速 dolly 可能引起运动模糊',
      0.75,
    ))

    return results
  }
}
