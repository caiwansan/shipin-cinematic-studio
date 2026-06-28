/**
 * prompt/cinematic-compiler.ts — Phase 0 导演语义编译器
 *
 * 职责（严格）: 唯一输出层
 *   ✅ IR → cinematic prompt text
 *   ✅ 格式化 + 排序 + prompt grammar
 *   ❌ 不做任何"理解"
 *
 * 宪法：
 *   1. 这是新流的主出口，旧 compilePrompt 冻结
 *   2. USE_DIRECTOR_V2=true 时默认走此路径
 *   3. 输出格式可被 LLM 和 Video Model 直接消费
 */

import type { DirectorIR } from './director-ir.js'

// ─── 编译配置 ─────────────────────────────────────────────────

const COMPILER_CONFIG = {
  /** 是否在 prompt 中包含 trace 信息（debug 用） */
  INCLUDE_TRACE: process.env.DIRECTOR_IR_TRACE === 'true',

  /** 是否使用结构化标签（如 CHARACTER: 前缀）而非自然语言 */
  USE_STRUCTURED_TAGS: true,
}

// ─── compileCinematicPrompt（核心入口） ──────────────────────

/**
 * 从 DirectorIR 编译成电影级 prompt
 *
 * 输出示例：
 *   CHARACTER: Alice (archetype: heroic protagonist, continuity locked)
 *   ACTION: walks into room
 *   EMOTION: curious, attentive
 *   CAMERA: medium close-up, static, 35mm f/1.8 — emphasize emotion, isolate subject
 *   SCENE: dim neon-lit interior with low contrast shadows
 *   ATMOSPHERE: intimate, mysterious — low-key lighting with deep shadows
 */
export function compileCinematicPrompt(ir: DirectorIR): string {
  if (COMPILER_CONFIG.USE_STRUCTURED_TAGS) {
    return compileStructured(ir)
  }
  return compileNatural(ir)
}

// ─── 格式化模式 ──────────────────────────────────────────────

/**
 * 结构化标签模式（推荐 — 更稳定、更可预测）
 */
function compileStructured(ir: DirectorIR): string {
  const parts: string[] = []

  // 角色
  ir.characters.forEach(c => {
    parts.push(`${c.name} (${c.archetype})`)
  })

  // 动作
  parts.push(ir.action.description)

  // 环境
  parts.push(
    `The scene takes place in ${ir.atmosphere.location}` +
    ` with ${ir.atmosphere.lighting}.`
  )

  // 镜头语言
  parts.push(
    `${ir.camera.shotType}, ${ir.camera.movement} camera movement, ${ir.camera.lens} lens`
  )

  // 氛围
  parts.push(`${ir.atmosphere.mood} atmosphere`)

  // 可选：trace
  if (COMPILER_CONFIG.INCLUDE_TRACE) {
    parts.push('')
    parts.push('[TRACE]')
    parts.push(`  emotion: ${ir.action.emotion} (${ir.action.emotionSource})`)
    parts.push(`  camera intent: ${ir.camera.intent} (${ir.camera.intentSource})`)
    parts.push(`  mood: ${ir.atmosphere.mood} (${ir.atmosphere.moodSource})`)
    ir.characters.forEach(c => {
      parts.push(`  ${c.name} archetype: ${c.archetype} (${c.archetypeSource})`)
    })
  }

  return parts.join('. ')
}

/**
 * 自然语言模式（兼容旧版）
 */
function compileNatural(ir: DirectorIR): string {
  const charNames = ir.characters.map(c => c.name).join(' and ')
  const emotions = ir.characters.map(() => ir.action.emotion).join(', ')

  return [
    `${ir.camera.shotType} with ${ir.camera.movement} camera movement.`,
    `${charNames}, ${emotions}, ${ir.action.description}.`,
    `The scene takes place in ${ir.atmosphere.location} with ${ir.atmosphere.lighting}.`,
    `${ir.camera.shotType}, ${ir.camera.lens}.`,
    `${ir.atmosphere.mood} atmosphere.`,
  ].join(' ')
}

// ─── 便利函数 ────────────────────────────────────────────────

/**
 * 从原始 shot 直接编译（normalize + interpret + compile 的一步调用）
 */
export function compileShot(shot: any): string {
  // 延迟加载避免循环依赖
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { normalizeShot } = require('./shot-normalizer.js') as typeof import('./shot-normalizer.js')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { toDirectorIR } = require('./director-ir.js') as typeof import('./director-ir.js')

  const normalized = normalizeShot(shot)
  const ir = toDirectorIR(normalized)
  return compileCinematicPrompt(ir)
}

/**
 * 获取完整 IR 对象（用于 debug / 序列化）
 */
export function analyzeShot(shot: any): DirectorIR {
  const { normalizeShot } = require('./shot-normalizer.js') as typeof import('./shot-normalizer.js')
  const { toDirectorIR } = require('./director-ir.js') as typeof import('./director-ir.js')
  return toDirectorIR(normalizeShot(shot))
}

export default { compileCinematicPrompt, compileShot, analyzeShot }
