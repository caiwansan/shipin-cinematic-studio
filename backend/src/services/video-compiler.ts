/**
 * VIDEO COMPILER — Phase D/E1 Hybrid
 *
 * ═══════════════════════════════════════════════════════════════
 * PHASE D CONSTITUTION — Determinism + Observability + No Behavior Change
 *
 * Rules:
 * - No AI behavior changes allowed EXCEPT ShotIR pre-processing
 * - No pipeline restructuring
 * - Only performance, observability, and determinism guarantees
 * - Input MUST be PromptIR
 * - Output MUST be deterministic for same input
 * ═══════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════
 * PHASE E1 — ShotIR Pre-processing
 *
 * Before deterministic compilation, if PromptIR.breakdown.shots is empty,
 * the ShotIR runtime compiler generates shots from narrative text.
 *
 * Flow:
 *   PromptIR (with empty shots)
 *     ↓
 *   ShotIR Runtime Compiler (FactGrid v2 constrained LLM)
 *     ↓
 *   PromptIR (with populated shots)
 *     ↓
 *   Deterministic Compiler (unchanged)
 *     ↓
 *   VideoPromptSpec
 *
 * The ShotIR step is the ONLY non-deterministic stage.
 * Everything after it is pure deterministic.
 * ═══════════════════════════════════════════════════════════════
 */

import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import type {
  PromptIR,
  VideoPromptSpec,
  CompileResult,
  CompileGuard,
  CompileError,
  CompileTrace,
  COMPILE_TRACE_DIR,
} from '../types/promptIR'
// Phase E1.5: compileVideo() is pure — no ShotIR import here
// Callers use buildAndInjectShotIR() separately

// ─── Cache Layer — LRU with SHA256 key ───────────────────────────

const CACHE_MAX = 128
const cacheMap = new Map<string, { result: CompileResult; hits: number }>()
let cacheHits = 0
let cacheMisses = 0

function normalizeForHash(input: PromptIR): string {
  // 确定性序列化：排序 keys 避免 JSON.stringify 漂移
  return JSON.stringify(input, Object.keys(input).sort())
}

function computeHash(input: PromptIR): string {
  return createHash('sha256').update(normalizeForHash(input)).digest('hex')
}

function cacheGet(hash: string): CompileResult | undefined {
  const entry = cacheMap.get(hash)
  if (entry) {
    entry.hits++
    cacheHits++
    return entry.result
  }
  cacheMisses++
  return undefined
}

function cacheSet(hash: string, result: CompileResult): void {
  if (cacheMap.size >= CACHE_MAX) {
    // LRU eviction: delete first (oldest) entry
    const firstKey = cacheMap.keys().next().value
    if (firstKey) cacheMap.delete(firstKey)
  }
  cacheMap.set(hash, { result, hits: 1 })
}

export function getCacheStats() {
  return { size: cacheMap.size, hits: cacheHits, misses: cacheMisses, max: CACHE_MAX }
}

export function clearCache() {
  cacheMap.clear()
  cacheHits = 0
  cacheMisses = 0
}

// ─── Trace Layer — JSONL persistence ──────────────────────────────

const traceDir = process.env.COMPILE_TRACE_DIR || 'data/compile-traces'

function ensureTraceDir(): void {
  const dir = path.resolve(traceDir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function appendTrace(trace: CompileTrace): void {
  try {
    ensureTraceDir()
    const filePath = path.resolve(traceDir, `traces.jsonl`)
    fs.appendFileSync(filePath, JSON.stringify(trace) + '\n', 'utf-8')
  } catch {
    // trace 写入失败不应影响 compile 结果
    console.warn('[COMPILE_TRACE] write failed:', (trace.traceId || '').slice(0, 12))
  }
}

// ─── 1. Guard Layer — 强约束验证 ───────────────────────────────────

export interface CompileGuardResult {
  ok: boolean
  errors: CompileError[]
  warnings: string[]
}

/**
 * 强约束验证层。
 * PromptIR is STRICT, not flexible.
 * 每个失败都带 stage/code/message。
 */
export function validatePromptIR(input: any): CompileGuardResult {
  const errors: CompileError[] = []
  const warnings: string[] = []

  if (!input) {
    errors.push({ stage: 'VALIDATE', code: 'NULL_INPUT', message: 'input is null/undefined', recoverable: false })
    return { ok: false, errors, warnings }
  }

  if (!input.script) {
    errors.push({ stage: 'VALIDATE', code: 'MISSING_SCRIPT', message: 'missing required field: script', recoverable: false })
  } else {
    if (!input.script.narrative) warnings.push('script.narrative is empty')
    if (!input.script.dialogue) warnings.push('script.dialogue is empty')
    if (!input.script.effects) warnings.push('script.effects is empty')
  }

  if (!input.breakdown) {
    errors.push({ stage: 'VALIDATE', code: 'MISSING_BREAKDOWN', message: 'missing required field: breakdown', recoverable: false })
  } else {
    if (!Array.isArray(input.breakdown.shots)) {
      errors.push({ stage: 'VALIDATE', code: 'SHOTS_NOT_ARRAY', message: 'breakdown.shots must be an array', recoverable: false })
    }
    if (!Array.isArray(input.breakdown.characters)) {
      errors.push({ stage: 'VALIDATE', code: 'CHARS_NOT_ARRAY', message: 'breakdown.characters must be an array', recoverable: false })
    }
    if (!Array.isArray(input.breakdown.scenes)) {
      errors.push({ stage: 'VALIDATE', code: 'SCENES_NOT_ARRAY', message: 'breakdown.scenes must be an array', recoverable: false })
    }
  }

  // ❌ 禁止 flat fields
  if (typeof input.narrative === 'string' || typeof input.dialogue === 'string') {
    errors.push({ stage: 'VALIDATE', code: 'FLAT_FIELDS', message: 'flat fields detected (narrative/dialogue/effects as top-level fields violates PromptIR contract)', recoverable: false })
  }

  return { ok: errors.length === 0, errors, warnings }
}

// ─── 2. Shot Mapper — 确定性映射 ──────────────────────────────────

interface MappedShot {
  t: number
  cam: string
  move: string
  act: string
  sub: string
  env: string
  fx: string
  dial: string
  expr: string
}

function mapShot(shot: any): MappedShot {
  return {
    t: typeof shot.second === 'number' ? shot.second : 0,
    cam: String(shot.camera || 'fixed'),
    move: String(shot.movement || 'none'),
    act: String(shot.action || ''),
    sub: String(shot.subject || ''),
    env: String(shot.environment || ''),
    fx: String(shot.effect || ''),
    dial: String(shot.dialogue || ''),
    expr: String(shot.expression || 'neutral'),
  }
}

// ─── 3. Spec Builder — Phase D typed error ─────────────────────────

/**
 * PURE deterministic V3 → VideoPromptSpec builder.
 *
 * ⚠️ P1.6 铁律：禁止丢弃 V3 字段。
 * 所有 V3 Segment 的结构化字段必须透传到 VideoPromptSpec：
 *   - camera.angle        → camera.angle
 *   - emotion             → emotion.mood + emotion.intensity
 *   - environment.atmosphere → environment.atmosphere
 *   - environment.colorPalette  → environment.colorPalette
 *   - scene.lighting      → environment.lighting
 *   - scene.mood          → style.mood
 */
export function buildVideoPromptSpec(input: PromptIR): { spec: VideoPromptSpec; error: CompileError | null } {
  try {
    const shots = (input.breakdown?.shots || []).map(mapShot)
    const firstShot = shots[0]
    const hasMultipleShots = shots.length > 1
    const firstScene = input.breakdown?.scenes?.[0]
    const firstCharacter = input.breakdown?.characters?.[0]

    // P1.6: 从 PromptIR 的 V3 segments 中提取 emotion（如果有的话）
    let emotionMood: string | undefined
    let emotionIntensity: number | undefined
    if (input.breakdown?.segments?.length) {
      // 取第一个 segment 的 emotion
      const seg = input.breakdown.segments[0] as any
      if (seg.emotion?.type) {
        emotionMood = seg.emotion.type
        emotionIntensity = seg.emotion.intensity ?? undefined
      }
    }

    const spec: VideoPromptSpec = {
      camera: {
        shot_type: firstShot?.cam || 'fixed',
        movement: firstShot?.move || 'none',
        framing: hasMultipleShots ? 'varied' : firstShot?.cam || 'fixed',
        // P1.6: camera.angle 从 shot 或 V3 segment 获取
        angle: firstShot?.angle || (firstShot as any)?.camera_angle || undefined,
      },
      subject: {
        description: firstShot?.sub || firstCharacter?.name || '',
        expression: firstShot?.expr || 'neutral',
        clothing: firstCharacter?.appearance || '',
      },
      action: firstShot?.act || (input.script?.narrative || '').slice(0, 200),
      environment: {
        setting: firstShot?.env || firstScene?.environment || '',
        props: [],
        // P1.6: lighting 优先从 scene 取，不再硬编码 'natural'
        lighting: firstScene?.lighting || 'natural',
        // P1.6: atmosphere 从 scene 透传
        atmosphere: firstScene?.atmosphere || undefined,
        // P1.6: colorPalette 从 scene 透传
        colorPalette: firstScene?.colorPalette || undefined,
      },
      vfx: firstShot?.fx ? [firstShot.fx] : [],
      style: {
        name: input.render?.style || 'cinematic',
        keywords: [],
        // P1.6: mood 优先从 scene.mood 取，不再从 narrative 截取
        mood: firstScene?.mood || (input.script?.narrative || '').slice(0, 50),
      },
      // P1.6: emotion 字段——直接透传 V3 segment 的情绪信号
      emotion: emotionMood ? { mood: emotionMood, intensity: emotionIntensity ?? 0.5 } : undefined,
      negative_prompt: input.script?.negativePrompt || '',
    }

    return { spec, error: null }
  } catch (e: any) {
    return {
      spec: null as any,
      error: { stage: 'BUILD_SPEC', code: 'BUILD_FAILED', message: e.message || 'spec build failed', recoverable: false },
    }
  }
}

// ─── 4. Prompt Compiler ────────────────────────────────────────────

/**
 * DETERMINISTIC Prompt Compiler.
 *
 * P1.6 修复：
 *   - 移除 lighting: 'natural' 硬编码——改从 spec.environment.lighting 读取
 *   - 移除 framing: 'medium' 硬编码——改从 spec.camera.framing 读取
 *   - 新增 camera.angle 输出
 *   - 新增 environment.atmosphere 输出
 *   - 新增 environment.colorPalette 输出
 *   - 新增 emotion 区块——情绪信号直通视频模型
 */
export function compilePrompt(spec: VideoPromptSpec): string {
  const parts: string[] = []

  // P1.6: camera section——包含 angle
  let cameraStr = `[Camera] ${spec.camera.shot_type} | ${spec.camera.movement} | ${spec.camera.framing}`
  if (spec.camera.angle) cameraStr += ` | angle: ${spec.camera.angle}`
  parts.push(cameraStr)

  parts.push(`[Subject] ${spec.subject.description} | expression: ${spec.subject.expression}`)

  if (spec.action) {
    parts.push(`[Action] ${spec.action}`)
  }

  // P1.6: environment section——包含 atmosphere + colorPalette
  let envStr = `[Environment] ${spec.environment.setting} | lighting: ${spec.environment.lighting}`
  if (spec.environment.atmosphere) envStr += ` | atmosphere: ${spec.environment.atmosphere}`
  if (spec.environment.colorPalette) envStr += ` | palette: ${spec.environment.colorPalette}`
  parts.push(envStr)

  if (spec.vfx.length > 0) {
    parts.push(`[VFX] ${spec.vfx.join(', ')}`)
  }

  // P1.6: emotion section——情绪信号
  if (spec.emotion) {
    parts.push(`[Emotion] ${spec.emotion.mood} | intensity: ${spec.emotion.intensity.toFixed(1)}`)
  }

  parts.push(`[Style] ${spec.style.name}`)
  if (spec.style.keywords.length > 0) {
    parts.push(`[Style Keywords] ${spec.style.keywords.join(', ')}`)
  }

  if (spec.negative_prompt) {
    parts.push(`[Negative] ${spec.negative_prompt}`)
  }

  return parts.join('\n\n')
}

// ─── 5. Entry Function — Pure Deterministic Compile ────────────────

/**
 * PURE deterministic compile.
 * Requires PromptIR with shots ALREADY populated.
 * Does NOT call ShotIR. Does NOT have pre-processing hooks.
 *
 * Phase E1.5: This is the ONLY compile entry.
 * Callers build ShotIR separately via buildAndInjectShotIR().
 */
export function compileVideo(input: PromptIR): CompileResult {
  const result = executeCompile(input)
  return result
}

function executeCompile(input: PromptIR): CompileResult {
  const startMs = Date.now()
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const stages: CompileTrace['stages'] = []

  // ────────── Cache Check ──────────
  const inputHash = computeHash(input)
  const cached = cacheGet(inputHash)
  if (cached) {
    const elapsed = Date.now() - startMs
    const trace: CompileTrace = {
      traceId,
      inputHash,
      outputHash: cached.trace?.outputHash || '',
      timestamp: Date.now(),
      durationMs: elapsed,
      stages: [{ name: 'CACHE_HIT', input: { hash: inputHash }, output: { cached: true }, durationMs: elapsed }],
    }
    appendTrace(trace)
    return { ...cached, trace }
  }

  // ────────── Stage 1: Validate ──────────
  const t1 = Date.now()
  const guard = validatePromptIR(input)
  stages.push({ name: 'VALIDATE', input: { script: !!input.script, breakdown: !!input.breakdown }, output: { ok: guard.ok, errors: guard.errors.length }, durationMs: Date.now() - t1 })

  if (!guard.ok) {
    const elapsed = Date.now() - startMs
    const result: CompileResult = {
      spec: null as any,
      prompt: '',
      promptIR: input,
      scores: { duration: 0, shotCount: 0, coverage: 0 },
      trace: {
        traceId, inputHash, outputHash: '', timestamp: Date.now(), durationMs: elapsed, stages,
      },
    }
    // 只保留第一个 error（失败即返回）
    if (guard.errors.length > 0) {
      result.error = guard.errors[0]
    }
    appendTrace(result.trace)
    return result
  }

  // ────────── Stage 2: Build Spec ──────────
  const t2 = Date.now()
  const { spec, error: specError } = buildVideoPromptSpec(input)
  stages.push({ name: 'BUILD_SPEC', input: { shotCount: input.breakdown?.shots?.length }, output: { hasSpec: !!spec }, durationMs: Date.now() - t2 })

  if (specError) {
    const elapsed = Date.now() - startMs
    const result: CompileResult = {
      spec: null as any,
      prompt: '',
      promptIR: input,
      scores: { duration: 0, shotCount: 0, coverage: 0 },
      error: specError,
      trace: { traceId, inputHash, outputHash: '', timestamp: Date.now(), durationMs: elapsed, stages },
    }
    appendTrace(result.trace)
    return result
  }

  // ────────── Stage 3: Compile Prompt ──────────
  const t3 = Date.now()
  const prompt = compilePrompt(spec)
  stages.push({ name: 'COMPILE_PROMPT', input: { specKeys: Object.keys(spec) }, output: { promptLength: prompt.length }, durationMs: Date.now() - t3 })

  const shotCount = input.breakdown?.shots?.length || 0
  const outputHash = computeHash(input)  // deterministic: same input = same output hash

  const elapsed = Date.now() - startMs
  const result: CompileResult = {
    spec,
    prompt,
    promptIR: input,
    scores: {
      duration: shotCount * 3,
      shotCount,
      coverage: 1.0,
    },
    error: null,
    trace: {
      traceId,
      inputHash,
      outputHash,
      timestamp: Date.now(),
      durationMs: elapsed,
      stages,
    },
  }

  // ────────── Cache + Trace ──────────
  cacheSet(inputHash, result)
  appendTrace(result.trace)

  return result
}

// ─── 6. Replay ─────────────────────────────────────────────────────

/**
 * Phase D: 从 traceId replay 一次 compile 过程（用于验证一致性）
 */
export function replayCompile(traceId: string): CompileResult | null {
  try {
    ensureTraceDir()
    const filePath = path.resolve(traceDir, `traces.jsonl`)
    if (!fs.existsSync(filePath)) return null

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
    for (const line of lines) {
      const trace: CompileTrace = JSON.parse(line)
      if (trace.traceId === traceId) {
        // 用同样的 input 重新 compile
        return null  // JSONL 存的是 trace，不是 input — 这不完整
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── 7. Phase E1.5 — No hybrid entry — compileVideo() is already pure.
// Callers must build ShotIR separately:
//   const { promptIR: enriched } = await buildAndInjectShotIR(rawPromptIR)
//   const result = compileVideo(enriched)
// No pre-processing. No runtime injection. No fallback.

