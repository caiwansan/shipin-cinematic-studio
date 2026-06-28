/**
 * prompt/ir-stability.ts — Phase 0.45 IR 稳定性/漂移观测层
 *
 * 职责（严格）: OBSERVATION ONLY
 *   ✅ IR 有效性验证
 *   ✅ IR 跨调用漂移检测
 *   ✅ IR 稳定性评分
 *   ❌ 不修改 IR schema
 *   ❌ 不调 LLM
 *   ❌ 不输出到 UI
 *
 * 宪法:
 *   1. 所有函数是纯 deterministic
 *   2. 不改变 IR 类型结构
 *   3. 结果仅写入 API response meta，不参与业务决策
 */

import type { DirectorIR, IRTrace } from './director-ir.js'

// ─── 类型 ─────────────────────────────────────────────────────────

export interface IRValidation {
  valid: boolean
  warnings: string[]
}

export interface IRStabilityMeta {
  validation: IRValidation
  stability: {
    score: number       // 0-1, 1 = 完全稳定
    label: 'stable' | 'drifting' | 'unknown'
  }
  version: string
  timestamp: number
}

export interface IREvolutionReport {
  driftScore: number    // 0-1, 0 = 无漂移
  stable: boolean
  notes: string[]
  deltas: IRDelta[]
}

export interface IRDelta {
  dimension: 'character' | 'emotion' | 'camera' | 'atmosphere'
  before: string
  after: string
  changed: boolean
}

// ─── 内存漂移追踪（进程内，不持久化） ─────────────────────────

const _lastIRStore = new Map<string, DirectorIR>()

// ─── validateDirectorIR ────────────────────────────────────────

/**
 * IR 有效性验证
 *
 * 检查点：
 *   - characters 不为空
 *   - camera 存在（允许 fallback）
 *   - emotion 存在（允许 fallback）
 *   - atmosphere 存在（允许 fallback）
 *   - trace 不为空
 *
 * 返回警告而非错误——IR 永远不会"不合法"，只是"不够好"
 */
export function validateDirectorIR(ir: DirectorIR): IRValidation {
  const warnings: string[] = []

  // characters
  if (!ir.characters || ir.characters.length === 0) {
    warnings.push('characters: 空（无角色被识别）')
  } else {
    ir.characters.forEach((c, i) => {
      if (c.archetype === 'neutral character') {
        warnings.push(`characters[${i}] "${c.name}": archetype 为默认值 "neutral character"（未匹配到已知原型）`)
      }
    })
  }

  // camera
  if (!ir.camera) {
    warnings.push('camera: 缺失（无镜头信息，将使用默认值）')
  } else {
    if (!ir.camera.shotType || ir.camera.shotType === 'medium shot') {
      warnings.push('camera.shotType: 为默认值 "medium shot"（未检测到明确的镜头类型）')
    }
    if (!ir.camera.intent || ir.camera.intent === 'standard coverage') {
      warnings.push('camera.intent: 为默认值 "standard coverage"（未匹配到已知镜头意图）')
    }
  }

  // emotion
  if (!ir.action || ir.action.emotion === 'neutral, composed') {
    warnings.push('emotion: 为默认值 "neutral, composed"（未匹配到已知情绪模式）')
  }

  // atmosphere
  if (!ir.atmosphere) {
    warnings.push('atmosphere: 缺失（环境氛围信息不可用）')
  } else {
    if (ir.atmosphere.mood === 'neutral atmospheric') {
      warnings.push('atmosphere.mood: 为默认值 "neutral atmospheric"（未匹配到已知氛围模式）')
    }
  }

  // trace
  if (!ir.trace) {
    warnings.push('trace: 缺失（无推断溯源信息）')
  } else {
    const traceKeys = (Object.keys(ir.trace) as Array<keyof IRTrace>)
      .filter(k => k !== 'archetypes')  // archetypes 单独统计
    let emptyTraceCount = 0
    for (const key of traceKeys) {
      const arr = ir.trace[key]
      if (!Array.isArray(arr) || arr.length === 0) emptyTraceCount++
    }
    if (emptyTraceCount > 0) {
      warnings.push(`trace: ${emptyTraceCount} 个维度无推断记录（默认值来源不可追踪）`)
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  }
}

// ─── inspectIREvolution ───────────────────────────────────────

/**
 * IR 漂移检测（与上一次 IR 对比）
 *
 * 输入：
 *   ir — 当前 IR
 *   prevIr — 上一次 IR（可选；不传则与内存缓存对比）
 *   key — 内存缓存 key（默认为 'default'）
 *
 * 输出：
 *   driftScore — 漂移分数 0-1（0=完全一致，1=完全改变）
 *   stable — 是否稳定（driftScore < 0.3）
 *   notes — 描述性说明
 *   deltas — 每个维度的变化详情
 */
export function inspectIREvolution(
  ir: DirectorIR,
  prevIr?: DirectorIR,
  key = 'default'
): IREvolutionReport {
  const prev = prevIr ?? _lastIRStore.get(key)
  const notes: string[] = []
  const deltas: IRDelta[] = []
  let totalChanges = 0
  let dimCount = 0

  if (!prev) {
    // 首次调用，无对比基准
    const report: IREvolutionReport = {
      driftScore: 0,
      stable: true,
      notes: ['首次观测 IR，无对比基准，默认标记为 stable'],
      deltas: [],
    }
    // 存入缓存
    _lastIRStore.set(key, JSON.parse(JSON.stringify(ir)))
    return report
  }

  // ── character 漂移 ──
  dimCount++
  const prevCharNames = new Set(prev.characters?.map(c => c.continuityKey) ?? [])
  const currCharNames = new Set(ir.characters?.map(c => c.continuityKey) ?? [])
  const charDelta: string[] = []
  for (const name of currCharNames) {
    if (!prevCharNames.has(name)) charDelta.push(`+${name}`)
  }
  for (const name of prevCharNames) {
    if (!currCharNames.has(name)) charDelta.push(`-${name}`)
  }
  if (charDelta.length > 0) {
    totalChanges++
    notes.push(`角色漂移: ${charDelta.join(', ')}`)
  }
  deltas.push({
    dimension: 'character',
    before: Array.from(prevCharNames).join(', '),
    after: Array.from(currCharNames).join(', '),
    changed: charDelta.length > 0,
  })

  // ── emotion 漂移 ──
  dimCount++
  const prevEmotion = prev.action?.emotion ?? ''
  const currEmotion = ir.action?.emotion ?? ''
  const emotionChanged = prevEmotion !== currEmotion
  if (emotionChanged) totalChanges++
  if (emotionChanged) notes.push(`情绪变化: "${prevEmotion}" → "${currEmotion}"`)
  deltas.push({
    dimension: 'emotion',
    before: prevEmotion,
    after: currEmotion,
    changed: emotionChanged,
  })

  // ── camera 漂移 ──
  dimCount++
  const prevCamera = `${prev.camera?.shotType ?? ''} ${prev.camera?.movement ?? ''} ${prev.camera?.intent ?? ''}`
  const currCamera = `${ir.camera?.shotType ?? ''} ${ir.camera?.movement ?? ''} ${ir.camera?.intent ?? ''}`
  const cameraChanged = prevCamera !== currCamera
  if (cameraChanged) totalChanges++
  if (cameraChanged) notes.push(`镜头变化: "${prevCamera.trim()}" → "${currCamera.trim()}"`)
  deltas.push({
    dimension: 'camera',
    before: prevCamera.trim(),
    after: currCamera.trim(),
    changed: cameraChanged,
  })

  // ── atmosphere 漂移 ──
  dimCount++
  const prevAtmos = `${prev.atmosphere?.location ?? ''} ${prev.atmosphere?.mood ?? ''}`
  const currAtmos = `${ir.atmosphere?.location ?? ''} ${ir.atmosphere?.mood ?? ''}`
  const atmosChanged = prevAtmos !== currAtmos
  if (atmosChanged) totalChanges++
  if (atmosChanged) notes.push(`氛围变化: "${prevAtmos.trim()}" → "${currAtmos.trim()}"`)
  deltas.push({
    dimension: 'atmosphere',
    before: prevAtmos.trim(),
    after: currAtmos.trim(),
    changed: atmosChanged,
  })

  // 漂移分数
  const driftScore = dimCount > 0 ? totalChanges / dimCount : 0
  const stable = driftScore <= 0.3

  if (stable && notes.length > 0) {
    notes.push(`总体: driftScore=${driftScore.toFixed(2)}，IR 稳定（变化在 0.3 阈值内）`)
  } else if (!stable) {
    notes.push(`⚠️ driftScore=${driftScore.toFixed(2)}，IR 漂移超过阈值，建议检查输入一致性`)
  }

  // 更新缓存
  _lastIRStore.set(key, JSON.parse(JSON.stringify(ir)))

  return { driftScore, stable, notes, deltas }
}

// ─── attachIRMeta ─────────────────────────────────────────────

/**
 * 为 IR 附加稳定性元数据
 *
 * 用法：
 *   const ir = toDirectorIR(normalized)
 *   const validation = validateDirectorIR(ir)
 *   const evolution = inspectIREvolution(ir)
 *   const meta = attachIRMeta(validation, evolution)
 */
export function attachIRMeta(
  validation: IRValidation,
  evolution: IREvolutionReport
): IRStabilityMeta {
  const driftScore = evolution.driftScore

  let label: IRStabilityMeta['stability']['label'] = 'unknown'
  if (driftScore === 0) {
    label = 'stable'
  } else if (driftScore <= 0.3) {
    label = 'stable'
  } else if (driftScore <= 0.6) {
    label = 'drifting'
  } else {
    label = 'drifting'
  }

  return {
    validation,
    stability: {
      score: 1 - driftScore,  // 逆转为稳定性分数（1=最稳定）
      label,
    },
    version: 'director-v2.0',
    timestamp: Date.now(),
  }
}

// ─── IR 状态快照（进程内可观测） ─────────────────────────────

/**
 * 获取当前 IR 快照摘要（诊断用）
 */
export function getIRSnapshot(key = 'default'): {
  hasBaseline: boolean
  baselineAge: number  // ms
} {
  const ir = _lastIRStore.get(key)
  return {
    hasBaseline: !!ir,
    baselineAge: ir ? Date.now() - Date.now() : 0,  // 进程内无法精确追踪时间，留空
  }
}

/**
 * 重置 IR 漂移基线（测试/切换场景时用）
 */
export function resetIRBaseline(key = 'default'): void {
  _lastIRStore.delete(key)
}

export default { validateDirectorIR, inspectIREvolution, attachIRMeta, getIRSnapshot, resetIRBaseline }
