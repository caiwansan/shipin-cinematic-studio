// ═══════════════════════════════════════════════════════════════
// Cinematic Compiler — CINIR → Model-Specific Prompt
// ═══════════════════════════════════════════════════════════════
// Pass 3: Cinematic IR → Timeline Beats
// Pass 4: Timeline Beats → Model-specific Prompt (WAN2.7)
//
// 当需要支持新模型时（Kling/Veo/Sora），
// 只需新增一个 adapter，不需要改 CinematicIR 和 Compiler。
// ═══════════════════════════════════════════════════════════════

import {
  CinematicSequence,
  TimelineBeat,
  ActionNode,
  CameraBinding,
  TransitionArc,
  VFXBinding,
} from './types.js'

// ─── Pass 3: CINIR → Timeline Beats ─────────────────

export function scheduleBeats(seq: CinematicSequence): TimelineBeat[] {
  // 按动作节点的时间范围构建 beats
  // 每个 beat 是语义上连续的一个"节拍"
  const beats: TimelineBeat[] = []

  if (seq.actions.length === 0) {
    // 空动作 → 一个默认 beat
    beats.push({
      start: 0,
      end: seq.totalDuration || 5,
      activeActions: [],
      energyLevel: 5,
    })
    return beats
  }

  // 排序动作按 startTime
  const sorted = [...seq.actions].sort((a, b) => a.startTime - b.startTime)

  for (const action of sorted) {
    // 找该时间段内的活跃镜头
    const camera = seq.cameraTrack.find(() => true) || seq.cameraTrack[0]
    // 该动作关联的 VFX
    const activeVFX = (action.vfx || [])
      .filter(v => v.duration > 0)
      .map(v => v.effect)

    beats.push({
      start: action.startTime,
      end: action.startTime + action.duration,
      activeActions: [action],
      dominantCamera: camera,
      emotionalState: action.emotion?.expression,
      energyLevel: intensityToEnergy(action.intensity),
      vfxActive: activeVFX.length > 0 ? activeVFX : undefined,
      description: `${action.action} (${action.intensity})`,
    })
  }

  return beats
}

function intensityToEnergy(intensity: string): number {
  const map: Record<string, number> = {
    light: 2,
    medium: 5,
    aggressive: 8,
    explosive: 10,
  }
  return map[intensity] || 5
}

// ─── Pass 4: Timeline Beats → WAN2.7 Prompt ─────────

export function compileWANPrompt(seq: CinematicSequence): string {
  const lines: string[] = []

  // 1. 动作链
  if (seq.actions.length > 0) {
    const actionStr = seq.actions
      .sort((a, b) => a.startTime - b.startTime)
      .map(a => {
        const intensityTag = a.intensity === 'aggressive' ? 'aggressive ' :
          a.intensity === 'explosive' ? 'explosive ' : ''
        const physicsTags = a.physics.map(p => `(${p.replace(/_/g, ' ')})`).join(' ')
        return `${intensityTag}${physicsTags}${a.action}`
      })
      .join(' -> ')
    lines.push(`[动作链] ${actionStr}`)
  }

  // 2. 镜头
  if (seq.cameraTrack.length > 0) {
    const cameraStr = seq.cameraTrack.map(c => {
      const shake = c.shake && c.shake > 5 ? '(shaky)' : ''
      const speed = c.speed && c.speed !== 1 ? `speed:${c.speed}x` : ''
      const focus = c.actorFocus ? ` focus:${c.actorFocus}` : ''
      return `[${c.shotType}${focus}]${shake}${speed ? `(${speed})` : ''}`
    }).join(' ')
    lines.push(`[镜头] ${cameraStr}`)
  }

  // 3. 特效
  const allVFX = [...new Set(
    seq.actions.flatMap(a => (a.vfx || []).map(v => v.effect.replace(/_/g, ' ')))
  )]
  if (allVFX.length > 0) {
    lines.push(`[特效] ${allVFX.join(' + ')}`)
  }

  // 4. 表情
  const emotions = seq.actions
    .filter(a => a.emotion)
    .map(a => `${a.actorId}:${a.emotion!.expression}`)
  if (emotions.length > 0) {
    lines.push(`[表情] ${emotions.join(' -> ')}`)
  }

  // 5. 过渡
  if (seq.transitions.length > 0) {
    const transStr = seq.transitions.map(t => {
      const overlap = t.overlapSeconds && t.overlapSeconds > 0 ? `(${t.overlapSeconds}s)` : ''
      return `${t.type}${overlap}`
    }).join(' -> ')
    lines.push(`[过渡] ${transStr}`)
  }

  // 6. 节奏
  lines.push(`[节奏] ${seq.pace}`)

  return lines.join('\n')
}

// ─── 高层编译器入口 ──────────────────────────────

export function compileCinematicSequence(seq: CinematicSequence): string {
  // 1. 先调度 beats
  seq.beats = scheduleBeats(seq)

  // 2. 编译为 WAN prompt
  seq.compiledPrompt = compileWANPrompt(seq)

  return seq.compiledPrompt
}
