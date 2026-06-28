/**
 * runtime/feedback-loop/auto-fixer.ts
 *
 * Prompt Compiler Auto-Fixer
 *
 * 职责：
 *   根据 PromptGap 自动修正 VideoPromptSpec。
 *   修正策略基于规则引擎（无需 LLM 调用），
 *   确保所有修改可追踪、可回退。
 *
 * 修正规则（固定）：
 *   if camera missing → strengthen camera tokens
 *   if vfx weak → upgrade physics descriptors
 *   if scene flat → increase spatial depth language
 *   if action weak → add motion arc phrasing
 *
 * @runtime feedback-loop
 */

import type { VideoPromptSpec } from '../../production-loop/prompt-compiler.js'
import type { PromptGap } from './prompt-diff.js'

// ============================================================
// Auto-Fix Result
// ============================================================

export interface AutoFixResult {
  /** 修正后的 spec */
  spec: VideoPromptSpec
  /** 本次修改的变更清单 */
  changes: string[]
  /** 修正置信度 0-1 */
  confidence: number
  /** 是否发生了实质性变化 */
  didChange: boolean
}

// ============================================================
// Fix Rules
// ============================================================

/**
 * 对 spec 执行自动修正
 * 基于 PromptGap 驱动规则引擎
 */
export function autoFix(spec: VideoPromptSpec, gap: PromptGap): AutoFixResult {
  const changes: string[] = []
  const fixed = deepCloneSpec(spec)
  let changeCount = 0

  // ─── Rule 1: Camera Fix ───
  if (gap.cameraMismatch.length > 0) {
    const camera = fixed.camera

    // Camera movement 加强
    if (camera.movement && camera.movement !== 'fixed' && gap.cameraMismatch.some(r => /missing|expected/.test(r))) {
      const strengthened = strengthenMovement(camera.movement)
      if (strengthened !== camera.movement) {
        fixed.camera.movement = strengthened
        changes.push(`camera.movement: "${camera.movement}" → "${strengthened}" (strengthened)`)
        changeCount++
      }
    }

    // Camera shot type 加强
    if (camera.shot_type) {
      const strengthened = strengthenShotType(camera.shot_type)
      if (strengthened !== camera.shot_type) {
        fixed.camera.shot_type = strengthened
        changes.push(`camera.shot_type: "${camera.shot_type}" → "${strengthened}" (added emphasis adjectives)`)
        changeCount++
      }
    }

    // 如果没有 lens，加一个默认镜头
    if (!camera.lens || camera.lens.length === 0) {
      fixed.camera.lens = inferLensFromShotType(camera.shot_type)
      changes.push(`camera.lens: added "${fixed.camera.lens}" (inferred from shot type)`)
      changeCount++
    }
  }

  // ─── Rule 2: VFX Fix ───
  if (gap.vfxMismatch.length > 0) {
    // 加强能量特效描述
    if (fixed.vfx.energy && fixed.vfx.energy.length > 0) {
      const upgraded = fixed.vfx.energy.map(e => upgradeEnergyDescriptor(e))
      const changed = upgraded.filter((u, i) => u !== fixed.vfx.energy![i])
      if (changed.length > 0) {
        changes.push(`vfx.energy: upgraded descriptors for physicality — ${changed.join(', ')}`)
        fixed.vfx.energy = upgraded
        changeCount++
      }
    }

    // 增加物理交互描述（如果缺失）
    if (!fixed.vfx.physics || fixed.vfx.physics.length === 0) {
      fixed.vfx.physics = ['environmental impact', 'air displacement']
      changes.push('vfx.physics: added "environmental impact, air displacement" (missing physics layer)')
      changeCount++
    }
  }

  // ─── Rule 3: Action Fix ───
  if (gap.actionMismatch.length > 0) {
    // 如果 action 太短或缺少运动弧线
    if (fixed.action.length < 30) {
      fixed.action = buildMotionArc(fixed.action, fixed.subject.main)
      changes.push(`action: expanded to full motion arc — start → peak → resolution`)
      changeCount++
    }

    // 如果 action 包含分段词
    if (/,[^,]*,[^,]*/.test(fixed.action) && /then|而后|然后|接着/.test(fixed.action)) {
      fixed.action = fixed.action
        .replace(/然后|接着|而后/g, ',')
        .replace(/，/g, ',')
      changes.push('action: merged segmented actions into continuous flow (removed "then/接着/然后")')
      changeCount++
    }
  }

  // ─── Rule 4: Environment Fix ───
  if (gap.environmentMismatch.length > 0) {
    // 增加空间深度描述
    if (!fixed.environment.atmosphere.includes('depth') && !fixed.environment.atmosphere.includes('foreground')) {
      const depthClause = 'with clear foreground-midground-background depth layers'
      fixed.environment.atmosphere = fixed.environment.atmosphere
        ? `${fixed.environment.atmosphere}, ${depthClause}`
        : depthClause
      changes.push('environment.atmosphere: added spatial depth layering')
      changeCount++
    }
  }

  // ─── Rule 5: Style Fix ───
  if (gap.fixDirectives.some(d => /style|cinematic/.test(d))) {
    // 确保 cinematic 风格关键词包含视觉属性
    const filmProperties = ['depth of field', 'cine color grading', 'soft cinematic shadows']
    for (const prop of filmProperties) {
      if (!fixed.style.keywords.some(k => k.toLowerCase().includes(prop.toLowerCase()))) {
        fixed.style.keywords.push(prop)
      }
    }
    changes.push('style.keywords: added cinematic visual attributes (depth of field, color grading, soft shadows)')
    changeCount++
  }

  // ─── Confidence ───
  const confidence = changeCount > 0
    ? Math.min(0.95, 0.5 + changeCount * 0.15)
    : 0

  return {
    spec: fixed,
    changes,
    confidence,
    didChange: changeCount > 0,
  }
}

// ============================================================
// Helper: Strengthen Functions
// ============================================================

/**
 * 加强 camera movement 描述
 */
function strengthenMovement(movement: string): string {
  const map: Record<string, string> = {
    'slow push-in': 'slow dramatic push-in',
    'push-in': 'slow dramatic push-in',
    'slow pull-out': 'gradual cinematic pull-out',
    'pull-out': 'gradual cinematic pull-out',
    'slow orbit': 'smooth cinematic orbit',
    'orbit': 'smooth cinematic orbit',
    'smooth tracking': 'continuous smooth tracking',
    'tracking': 'continuous smooth tracking',
    'panning': 'slow deliberate panning',
    'pan': 'slow deliberate panning',
    'tilt': 'slow cinematic tilt',
    'crane movement': 'graceful crane movement',
    'crane': 'graceful crane movement',
    'handheld shake': 'controlled handheld shake',
    'shake': 'controlled handheld shake',
  }
  return map[movement.toLowerCase()] || movement
}

/**
 * 加强 shot type 描述
 */
function strengthenShotType(shotType: string): string {
  const map: Record<string, string> = {
    'wide shot': 'wide establishing shot',
    'wide': 'wide establishing shot',
    'close-up shot': 'intimate close-up shot',
    'close-up': 'intimate close-up shot',
    'low-angle shot': 'dramatic low-angle shot',
    'low-angle': 'dramatic low-angle shot',
    'aerial shot': 'sweeping aerial shot',
    'aerial': 'sweeping aerial shot',
    'medium shot': 'balanced medium shot',
    'over-shoulder shot': 'immersive over-shoulder shot',
  }
  return map[shotType.toLowerCase()] || shotType
}

/**
 * 根据 shot type 推断镜头焦段
 */
function inferLensFromShotType(shotType: string): string {
  const lower = shotType.toLowerCase()
  if (/wide|aerial/.test(lower)) return '24mm wide angle'
  if (/medium/.test(lower)) return '50mm standard'
  if (/close|detail/.test(lower)) return '85mm portrait'
  if (/over.shoulder/.test(lower)) return '35mm cinematic'
  if (/low|high/.test(lower)) return '35mm cinematic'
  return '50mm cinematic'
}

/**
 * 升级能量特效描述词 — 增加物理属性
 */
function upgradeEnergyDescriptor(energy: string): string {
  // 如果已经有物理属性就跳过
  if (/emitting|radiating|pulsing|flowing|converging|expanding|contracting/.test(energy)) {
    return energy
  }
  // 如果是简单名词，加物理动词前缀
  if (/aura|beam|field|flux|wave|glow|light/.test(energy.toLowerCase())) {
    return `radiating, pulsing ${energy}`
  }
  return energy
}

/**
 * 构建完整动作弧线描述
 * start → peak → resolution
 */
function buildMotionArc(action: string, subject: string): string {
  const verbMatch = action.match(/^([^，,]+)/)
  const verb = verbMatch ? verbMatch[1].trim() : action

  // 根据动词类型构建弧线
  if (/roar|shout|scream|呐喊|咆哮|怒吼/.test(verb)) {
    return `${subject} begins with a building tension, then unleashes a powerful ${verb} that peaks with maximum intensity, finally settling with residual energy ripples`
  }
  if (/charge|rush|冲锋|冲刺|俯冲/.test(verb)) {
    return `${subject} starts from a stationary position, accelerates into a powerful ${verb} reaching peak speed, and completes the motion with impact force`
  }
  if (/strike|punch|kick|hit|blow|击|打|踢|劈/.test(verb)) {
    return `${subject} coils in preparation, executes a precise ${verb} with explosive speed at the point of impact, and follows through with momentum`
  }
  if (/jump|leap|fly|腾空|飞|跃/.test(verb)) {
    return `${subject} crouches in anticipation, launches into a powerful ${verb} reaching maximum height, and descends with controlled landing`
  }

  return `${action} — a single continuous motion from start through peak to completion`
}

function deepCloneSpec(spec: VideoPromptSpec): VideoPromptSpec {
  return JSON.parse(JSON.stringify(spec))
}
