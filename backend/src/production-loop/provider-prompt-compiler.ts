/**
 * production-loop/provider-prompt-compiler.ts
 *
 * Phase 1.8 — Provider Adapter De-Legacyization
 *
 * ProviderPromptCompiler: 将 ProviderVideoInput 编译为 ProviderNativePayload。
 *
 * 这是 Adapter 去字符串化的核心编译层：
 *   ProviderVideoInput { prompt, camera[], lighting, vfx[], motion[], ... }
 *     ↓
 *   ProviderNativePayload { compiledPrompt, promptBlocks[], cameraDirectives[], ... }
 *
 * 规则：
 *   1. 只做"编译/拼接"，不做"生成/调用 LLM"
 *   2. 输入是 ProviderVideoInput，输出是 ProviderNativePayload
 *   3. 安全模式：所有输入可选，无输入则返回纯文本 compiledPrompt
 */

import type { ProviderVideoInput } from './provider-input.js'
import type {
  ProviderNativePayload,
  PromptBlock,
  CameraDirective,
  VFXDirective,
  MotionDirective,
  LightingDirective,
} from './provider-native-payload.js'

// ── 编译模式 ──

type CompileMode = 'native' | 'hybrid' | 'legacy'

/**
 * 将 ProviderVideoInput 编译为 Provider 最终消费的 NativePayload
 *
 * 编译策略：
 *   - 有 shotGraph + cameraDirectives → native
 *   - 只有 compiledPrompt → legacy
 *   - 有部分字段但非结构化 → hybrid
 */
export function compileProviderPayload(input: ProviderVideoInput): ProviderNativePayload {
  const hasCamera = input.camera && input.camera.length > 0
  const hasVFX = input.vfx && input.vfx.length > 0
  const hasMotion = input.motion && input.motion.length > 0
  const hasLighting = input.lighting !== undefined

  // ── 确定模式 ──
  let mode: CompileMode
  if (hasCamera || hasVFX || hasMotion || hasLighting) {
    mode = input.camera && input.camera.length >= 1 ? 'native' : 'hybrid'
  } else {
    mode = 'legacy'
  }

  console.log(`[ProviderPromptCompiler] mode=${mode}, camera=${hasCamera}, vfx=${hasVFX}, motion=${hasMotion}, lighting=${hasLighting}`)

  // ── 构建 PromptBlocks ──
  const promptBlocks: PromptBlock[] = buildPromptBlocks(input)

  // ── 编译最终 Prompt 文本 ──
  const compiledPrompt = compilePromptText(input, promptBlocks, mode)

  // ── CameraDirectives ──
  const cameraDirectives: CameraDirective[] = (input.camera || []).map(c => ({
    shotType: c.shotType,
    movement: c.movement,
    lens: c.lens,
    focalLength: c.focalLength,
    depthOfField: c.depthOfField,
    angle: c.angle,
    intent: c.intent,
  }))

  // ── VFXDirectives ──
  const vfxDirectives: VFXDirective[] = (input.vfx || []).map(v => ({
    type: v.type,
    description: v.description,
    intensity: v.intensity,
    timing: v.timing,
    duration: v.duration,
  }))

  // ── MotionDirectives ──
  const motionDirectives: MotionDirective[] = (input.motion || []).map(m => ({
    type: m.type as MotionDirective['type'] || 'action',
    actor: m.actor,
    speed: m.speed,
    duration: m.duration,
    description: m.description,
  }))

  // ── LightingDirective ──
  const lightingDirective: LightingDirective | undefined = input.lighting
    ? {
        style: input.lighting.style,
        keyLight: input.lighting.keyLight,
        fillLight: input.lighting.fillLight,
        backLight: input.lighting.backLight,
        ambient: input.lighting.ambient,
        colorTemperature: input.lighting.colorTemperature,
        mood: input.lighting.mood,
      }
    : undefined

  // ── 元信息 ──
  const meta = {
    mode,
    shotGraphUsed: !!(hasCamera || hasMotion),
    effectSpecsUsed: !!hasVFX,
    promptSpecUsed: !!(hasLighting || cameraDirectives.length > 0),
  }

  console.log(`[PROVIDER_ADAPTER_MODE] mode=${mode}`)

  return {
    compiledPrompt,
    promptBlocks: promptBlocks.length > 0 ? promptBlocks : undefined,
    cameraDirectives: cameraDirectives.length > 0 ? cameraDirectives : undefined,
    vfxDirectives: vfxDirectives.length > 0 ? vfxDirectives : undefined,
    motionDirectives: motionDirectives.length > 0 ? motionDirectives : undefined,
    lightingDirective,
    meta,
  }
}

// ── 内部函数 ──

function buildPromptBlocks(input: ProviderVideoInput): PromptBlock[] {
  const blocks: PromptBlock[] = []

  // 叙事块
  if (input.prompt) {
    blocks.push({ type: 'narrative', content: input.prompt, priority: 0 })
  }

  // 灯光块
  if (input.lighting) {
    const parts: string[] = []
    if (input.lighting.style) parts.push(`灯光风格：${input.lighting.style}`)
    if (input.lighting.keyLight) parts.push(`主光：${input.lighting.keyLight}`)
    if (input.lighting.mood) parts.push(`氛围：${input.lighting.mood}`)
    if (input.lighting.colorTemperature) parts.push(`色温：${input.lighting.colorTemperature}`)
    if (parts.length > 0) {
      blocks.push({ type: 'style', content: parts.join('\n'), priority: 1 })
    }
  }

  // 镜头指令块（从 cameraDirectives 编译）
  if (input.camera && input.camera.length > 0) {
    const cameraLines = input.camera.map((c, i) => {
      const parts: string[] = []
      if (c.shotType) parts.push(`景别：${c.shotType}`)
      if (c.movement) parts.push(`运镜：${c.movement}`)
      if (c.lens) parts.push(`焦段：${c.lens}`)
      if (c.angle) parts.push(`角度：${c.angle}`)
      if (c.intent) parts.push(`意图：${c.intent}`)
      return `[镜头${i + 1}] ${parts.join(' | ')}`
    })
    blocks.push({ type: 'style', content: cameraLines.join('\n'), priority: 2 })
  }

  // VFX 块
  if (input.vfx && input.vfx.length > 0) {
    const vfxLines = input.vfx.map(v => {
      const parts = [`类型：${v.type}`]
      if (v.description) parts.push(`描述：${v.description}`)
      if (v.intensity) parts.push(`强度：${v.intensity}`)
      if (v.timing) parts.push(`时机：${v.timing}`)
      return parts.join(' | ')
    })
    blocks.push({ type: 'effect', content: `【视觉特效】\n${vfxLines.join('\n')}`, priority: 3 })
  }

  // Motion 块
  if (input.motion && input.motion.length > 0) {
    const motionLines = input.motion.map(m => {
      const parts = [`动作：${m.description || m.type}`]
      if (m.actor) parts.push(`角色：${m.actor}`)
      if (m.speed) parts.push(`速度：${m.speed}`)
      return parts.join(' | ')
    })
    blocks.push({ type: 'effect', content: `【动作/运动】\n${motionLines.join('\n')}`, priority: 3 })
  }

  return blocks.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
}

function compilePromptText(
  input: ProviderVideoInput,
  blocks: PromptBlock[],
  mode: CompileMode,
): string {
  if (mode === 'legacy' || mode === 'hybrid') {
    // hybrid/legacy: 退回用输入 prompt
    return input.prompt || ''
  }

  // native: 从 promptBlocks 编译
  const narrative = blocks.filter(b => b.type === 'narrative').map(b => b.content).join('\n\n')
  const style = blocks.filter(b => b.type === 'style').map(b => b.content).join('\n\n')
  const effects = blocks.filter(b => b.type === 'effect').map(b => b.content).join('\n\n')

  return [
    narrative,
    style ? `## 视觉风格\n${style}` : '',
    effects ? `## 特效\n${effects}` : '',
  ].filter(Boolean).join('\n\n')
}
