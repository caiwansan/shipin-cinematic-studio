// ═══════════════════════════════════════════════════════════════
// Cinematic Validator — IR 校验 + 自动修正
// ═══════════════════════════════════════════════════════════════
// LLM 输出的 Intent 可能包含非法/矛盾/物理不可能的组合。
// Validator 在 IR → Timeline 阶段前做检查 + 自动降级。
// ═══════════════════════════════════════════════════════════════

import {
  CinematicSequence,
  ActionNode,
  TransitionArc,
  CameraBinding,
  TimelineBeat,
} from './types.js'

// ─── 校验级别 ───────────────────────────────────────

export type ValidationLevel = 'error' | 'warn' | 'info'

export interface ValidationIssue {
  level: ValidationLevel
  code: string              // 机器可读的错误码
  message: string           // 人类可读描述
  location: string          // 出问题的节点 ID / beat index
  autoFix?: boolean         // 是否可自动修复
}

// ─── 校验器 ─────────────────────────────────────────

export interface CinematicValidator {
  name: string
  validate(seq: CinematicSequence): ValidationIssue[]
}

// ─── 延迟阶段校验 ──────────────────────────────────

export interface PhaseValidator extends CinematicValidator {
  phase: 'pre_schedule' | 'post_schedule'
}

// ─── 1. 时间重叠校验 ───────────────────────────────

export class TimeOverlapValidator implements CinematicValidator {
  name = 'TimeOverlap'

  validate(seq: CinematicSequence): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const sorted = [...seq.actions].sort((a, b) => a.startTime - b.startTime)

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i]
      const next = sorted[i + 1]
      const currEnd = curr.startTime + curr.duration
      if (currEnd > next.startTime) {
        issues.push({
          level: 'warn',
          code: 'TIME_OVERLAP',
          message: `动作 "${curr.action}" (结束于 ${currEnd}s) 与 "${next.action}" (开始于 ${next.startTime}s) 时间重叠 ${(currEnd - next.startTime).toFixed(1)}s`,
          location: `${curr.id} -> ${next.id}`,
          autoFix: true,
        })
      }
    }
    return issues
  }
}

// ─── 2. 镜头冲突校验 ───────────────────────────────

export class CameraConflictValidator implements CinematicValidator {
  name = 'CameraConflict'

  validate(seq: CinematicSequence): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    // 检查同一时间是否有多个主导镜头
    if (seq.beats.length < 2) return issues

    for (let i = 0; i < seq.beats.length - 1; i++) {
      const beat = seq.beats[i]
      const next = seq.beats[i + 1]
      if (beat.dominantCamera && next.dominantCamera &&
          beat.dominantCamera.shotType === next.dominantCamera.shotType &&
          beat.end === next.start) {
        // 连续两个 beat 相同镜头 → 可能单调，但非错误
      }
    }

    // 检查过渡中的镜头突变（手持→稳定无过渡）
    for (const trans of seq.transitions) {
      if (trans.type === 'smooth') {
        const fromAction = seq.actions.find(a => a.id === trans.fromActionId)
        const toAction = seq.actions.find(a => a.id === trans.toActionId)
        if (fromAction && toAction &&
            Math.abs(fromAction.startTime + fromAction.duration - toAction.startTime) > 0.5) {
          issues.push({
            level: 'warn',
            code: 'TRANSITION_GAP',
            message: `smooth transition "${trans.type}" 但动作间有 ${(toAction.startTime - (fromAction.startTime + fromAction.duration)).toFixed(1)}s 间隙`,
            location: `${trans.fromActionId} -> ${trans.toActionId}`,
            autoFix: true,
          })
        }
      }
    }

    return issues
  }
}

// ─── 3. 动作-镜头匹配校验 ──────────────────────────

const RECOMMENDED_CAMERA: Partial<Record<string, string[]>> = {
  leap: ['low_angle', 'bird_eye', 'follow_cam'],
  jump: ['low_angle', 'follow_cam'],
  rush: ['tracking_left', 'tracking_right', 'follow_cam', 'handheld'],
  punch: ['close_up', 'extreme_close_up', 'handheld'],
  kick: ['medium', 'tracking_left'],
  soar: ['low_angle', 'bird_eye', 'orbit'],
  slam: ['top_down', 'bird_eye', 'low_angle'],
  landing: ['low_angle', 'shake'],
  chase: ['tracking_left', 'tracking_right', 'follow_cam'],
  block: ['over_shoulder', 'close_up'],
}

export class ActionCameraValidator implements CinematicValidator {
  name = 'ActionCameraMatch'

  validate(seq: CinematicSequence): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    for (const action of seq.actions) {
      const recommended = RECOMMENDED_CAMERA[action.action]
      if (!recommended) continue

      const hasMatchedCamera = seq.cameraTrack.some(c => recommended.includes(c.shotType))
      if (!hasMatchedCamera) {
        issues.push({
          level: 'info',
          code: 'CAMERA_RECOMMENDATION',
          message: `动作 "${action.action}" 建议使用镜头 [${recommended.join('|')}]，当前未匹配`,
          location: action.id,
          autoFix: false,
        })
      }
    }

    return issues
  }
}

// ─── 4. 过渡-动作冲突校验 ─────────────────────────

const COMPATIBLE_TRANSITIONS: Record<string, string[]> = {
  leap: ['momentum_carry', 'smooth', 'hard_cut'],
  jump: ['momentum_carry', 'smooth'],
  rush: ['momentum_carry', 'smooth', 'sudden_stop'],
  sprint: ['momentum_carry', 'sudden_stop'],
  punch: ['impact_freeze', 'snap', 'hard_cut'],
  kick: ['impact_freeze', 'snap'],
  block: ['impact_freeze', 'hard_cut'],
  land: ['smooth', 'hard_cut'],
  soar: ['smooth', 'momentum_carry'],
}

export class TransitionCompatValidator implements CinematicValidator {
  name = 'TransitionCompatibility'

  validate(seq: CinematicSequence): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    for (const trans of seq.transitions) {
      const toAction = seq.actions.find(a => a.id === trans.toActionId)
      if (!toAction) continue

      const compatible = COMPATIBLE_TRANSITIONS[toAction.action]
      if (compatible && !compatible.includes(trans.type)) {
        issues.push({
          level: 'warn',
          code: 'TRANSITION_INCOMPATIBLE',
          message: `动作 "${toAction.action}" 不兼容过渡 "${trans.type}"，建议改为 [${compatible.join('|')}]`,
          location: `${trans.fromActionId} -> ${trans.toActionId}`,
          autoFix: true,
        })
      }
    }

    return issues
  }
}

// ─── 5. 物理不可能校验（简单的）───────────────────

export class PhysicsConstraintValidator implements CinematicValidator {
  name = 'PhysicsConstraint'

  validate(seq: CinematicSequence): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    for (const action of seq.actions) {
      // 急停后立刻爆发奔跑 → 不物理
      if (action.physics.includes('rigid') && action.action === 'rush') {
        issues.push({
          level: 'warn',
          code: 'PHYSICS_CONTRADICTION',
          message: `动作 "${action.action}" 标记为 rigid（僵硬），但 rush 需要 snappy 或 momentum_carry`,
          location: action.id,
          autoFix: true,
        })
      }

      // explosive + floaty → 不协调
      if (action.intensity === 'explosive' && action.physics.includes('floaty')) {
        issues.push({
          level: 'info',
          code: 'PHYSICS_COMBINATION_UNUSUAL',
          message: `动作 "${action.action}" 组合 explosive + floaty 可能产生不自然的膨胀感`,
          location: action.id,
          autoFix: false,
        })
      }

      // 强度冲突
      if (action.intensity === 'light' && action.physics.includes('heavy_impact')) {
        issues.push({
          level: 'warn',
          code: 'INTENSITY_PHYSICS_MISMATCH',
          message: `动作 "${action.action}" 强度为 light 但有 heavy_impact 修饰，建议降低物理等级`,
          location: action.id,
          autoFix: true,
        })
      }
    }

    return issues
  }
}

// ─── 6. 全局一致性校验 ────────────────────────────

export class GlobalConsistencyValidator implements CinematicValidator {
  name = 'GlobalConsistency'

  validate(seq: CinematicSequence): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    // 总时长检查
    if (seq.totalDuration <= 0) {
      issues.push({
        level: 'error',
        code: 'ZERO_DURATION',
        message: '片段总时长为零',
        location: 'metadata',
        autoFix: true,
      })
    }

    // 空动作检查
    if (seq.actions.length === 0 && seq.compiledPrompt) {
      issues.push({
        level: 'warn',
        code: 'NO_STRUCTURED_ACTIONS',
        message: '有 compiledPrompt 但 actions 为空（LLM 未解析为 IR），将使用原始字符串',
        location: 'actions',
        autoFix: false,
      })
    }

    return issues
  }
}

// ─── 修复器 ─────────────────────────────────────────

export const AUTO_FIXES: Record<string, (seq: CinematicSequence, issue: ValidationIssue) => boolean> = {
  TIME_OVERLAP: (seq, issue) => {
    // 把重叠的动作稍微错开
    const ids = issue.location.split(' -> ')
    const curr = seq.actions.find(a => a.id === ids[0])
    const next = seq.actions.find(a => a.id === ids[1])
    if (curr && next) {
      const currEnd = curr.startTime + curr.duration
      if (currEnd > next.startTime) {
        next.startTime = currEnd + 0.1  // 加 0.1s 缓冲
        return true
      }
    }
    return false
  },

  TRANSITION_GAP: (seq, issue) => {
    // 缩小间隙到 0.1s
    const ids = issue.location.split(' -> ')
    const from = seq.actions.find(a => a.id === ids[0])
    const to = seq.actions.find(a => a.id === ids[1])
    if (from && to) {
      const fromEnd = from.startTime + from.duration
      if (to.startTime - fromEnd > 0.1) {
        to.startTime = fromEnd + 0.1
        return true
      }
    }
    return false
  },
}

// ─── Validator Runner ───────────────────────────────

export function validateSequence(
  seq: CinematicSequence,
  options?: { autoFix?: boolean },
): ValidationIssue[] {
  const allIssues: ValidationIssue[] = []

  const validators: CinematicValidator[] = [
    new TimeOverlapValidator(),
    new CameraConflictValidator(),
    new ActionCameraValidator(),
    new TransitionCompatValidator(),
    new PhysicsConstraintValidator(),
    new GlobalConsistencyValidator(),
  ]

  for (const v of validators) {
    try {
      const issues = v.validate(seq)
      allIssues.push(...issues)

      // 自动修复
      if (options?.autoFix) {
        for (const issue of issues) {
          if (issue.autoFix && issue.code in AUTO_FIXES) {
            const fixed = AUTO_FIXES[issue.code](seq, issue)
            if (fixed) {
              issue.level = 'info'
              issue.message += ' [已自动修复]'
            }
          }
        }
      }
    } catch (e: any) {
      allIssues.push({
        level: 'error',
        code: 'VALIDATOR_CRASH',
        message: `校验器 ${v.name} 崩溃: ${e.message}`,
        location: 'unknown',
      })
    }
  }

  return allIssues
}

// ─── 友好输出 ──────────────────────────────────────

export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return '✅ 全部校验通过'

  const groups = { error: [] as ValidationIssue[], warn: [] as ValidationIssue[], info: [] as ValidationIssue[] }
  for (const iss of issues) groups[iss.level].push(iss)

  const lines: string[] = []
  if (groups.error.length > 0) {
    lines.push(`❌ ${groups.error.length} 个错误:`)
    groups.error.forEach(i => lines.push(`   [${i.code}] ${i.message}`))
  }
  if (groups.warn.length > 0) {
    lines.push(`⚠️ ${groups.warn.length} 个警告:`)
    groups.warn.forEach(i => lines.push(`   [${i.code}] ${i.message}`))
  }
  if (groups.info.length > 0) {
    lines.push(`ℹ️ ${groups.info.length} 条建议:`)
    groups.info.forEach(i => lines.push(`   [${i.code}] ${i.message}`))
  }

  return lines.join('\n')
}
