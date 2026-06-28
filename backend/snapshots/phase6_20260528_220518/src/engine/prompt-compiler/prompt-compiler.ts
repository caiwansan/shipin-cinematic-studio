/**
 * prompt-compiler.ts — Director Layer v6.5 Prompt Compiler 核心
 *
 * 职责：VP-IR → Model Dialect（模型方言）的确定性编译。
 *
 * 编译流程：
 *   1. 接收 VP-IR + 目标模型标识
 *   2. 拆解 VP-IR 为 PromptComponents
 *   3. 根据模型语法调用对应的 promptBuilder
 *   4. 验证约束 → 编译 negative prompt
 *   5. 返回编译结果：modelReadyPrompt + humanReadableSummary
 *
 * 设计原则：
 *   1. 纯函数 — 相同输入总是相同输出
 *   2. 零 AI 依赖 — 不做任何 LLM 调用
 *   3. 可审计 — 编译过程可 trace
 */

import {
  type VisualPromptIR,
  validateIR,
} from './visual-prompt-ir.js'
import {
  type PromptComponents,
  type SupportedModel,
  getGrammar,
} from './model-grammar.js'
import {
  checkAllConstraints,
  type ConstraintViolation,
} from './cinematic-constraints.js'

// ============================================================
// 编译结果
// ============================================================

export interface CompileResult {
  /** 模型可直接使用的 prompt */
  modelReadyPrompt: string
  /** 模型可用的 negative prompt */
  modelReadyNegative: string
  /** 人类可读的摘要（用于 UI 展示） */
  humanReadableSummary: string
  /** 约束违反列表 */
  violations: ConstraintViolation[]
  /** 生成该 prompt 的模型 */
  targetModel: SupportedModel
  /** 编译 trace */
  trace: CompilationTrace
}

export interface CompilationTrace {
  sourceIR: boolean
  modelGrammar: string
  componentsExtracted: boolean
  constraintCheckCount: number
  constraintViolations: number
  totalPromptChars: number
}

// ============================================================
// IR → PromptComponents 转换
// ============================================================

function extractComponents(ir: VisualPromptIR): PromptComponents {
  // Camera description
  const cameraParts: string[] = []
  if (ir.camera.shotType) {
    const shotLabels: Record<string, string> = {
      'close-up': '特写',
      'medium': '中景',
      'wide': '全景',
      'aerial': '航拍',
      'over-the-shoulder': '过肩镜头',
      'extreme-close-up': '大特写',
    }
    cameraParts.push(shotLabels[ir.camera.shotType] || ir.camera.shotType)
  }
  if (ir.camera.angle) cameraParts.push(ir.camera.angle)
  if (ir.camera.lens) cameraParts.push(ir.camera.lens)

  const cameraStr = cameraParts.join('，')

  // Lighting description
  const lightingParts: string[] = []
  if (ir.lighting.type) {
    const lightLabels: Record<string, string> = {
      soft: '柔光',
      hard: '硬光',
      dramatic: '戏剧光',
      natural: '自然光',
      backlit: '背光',
      rim: '轮廓光',
    }
    lightingParts.push(lightLabels[ir.lighting.type] || ir.lighting.type)
  }
  if (ir.lighting.direction) lightingParts.push(ir.lighting.direction)
  if (ir.lighting.intensity) lightingParts.push(ir.lighting.intensity)
  if (ir.lighting.colorTemp) lightingParts.push(ir.lighting.colorTemp)

  const lightingStr = lightingParts.join('，')

  // Action (for video model)
  const actionStr = ir.action
    ? [ir.action.details, ir.action.expression, ir.action.pacing + '节奏'].filter(Boolean).join('，')
    : undefined

  // Environment
  const envStr = [
    ir.scene.environment,
    ir.scene.timeOfDay,
    ir.scene.atmosphere,
  ]
    .filter(Boolean)
    .join('，')

  // Style
  const styleParts = [ir.style.cinematicStyle]
  if (ir.style.referenceAesthetic) styleParts.push(ir.style.referenceAesthetic)
  const styleStr = styleParts.join('、')

  return {
    subject: ir.subject,
    environment: envStr,
    lighting: lightingStr,
    camera: cameraStr,
    style: styleStr,
    action: actionStr,
    effects: ir.effects?.description,
    temporalMotion: ir.temporal
      ? `从[${ir.temporal.continuityFrom || '无'}]过渡到[${ir.temporal.continuityTo || '无'}]`
      : undefined,
    colorPalette: ir.style.colorPalette,
  }
}

// ============================================================
// Negative Prompt 编译
// ============================================================

function compileNegative(ir: VisualPromptIR, model: SupportedModel): string {
  const negatives: string[] = [
    ...ir.constraints.avoid,
  ]

  if (ir.constraints.extraNegative) {
    negatives.push(ir.constraints.extraNegative)
  }

  // 模型特定默认负面
  if (model === 'sdxl') {
    negatives.push('畸形手指，扭曲面容，模糊，低质量')
  } else if (model === 'flux') {
    negatives.push('模糊，次品，变形')
  } else if (model === 'wan') {
    negatives.push('闪烁，卡顿，画面撕裂，变形，鬼影')
  }

  return negatives.filter(Boolean).join(', ')
}

// ============================================================
// Human-readable summary 生成
// ============================================================

function buildHumanSummary(ir: VisualPromptIR): string {
  const parts: string[] = []

  // 主体
  parts.push(ir.subject)

  // 场景
  if (ir.scene.environment) parts.push(`在${ir.scene.environment}`)

  // 镜头
  const shotLabels: Record<string, string> = {
    'close-up': '特写',
    'medium': '中景',
    'wide': '全景',
    'aerial': '航拍',
    'over-the-shoulder': '过肩',
    'extreme-close-up': '大特写',
  }
  const shotLabel = shotLabels[ir.camera.shotType] || ir.camera.shotType
  parts.push(`${shotLabel}，${ir.camera.angle || ''}，${ir.camera.lens || ''}`)

  // 灯光
  const lightLabels: Record<string, string> = {
    soft: '柔光',
    hard: '硬光',
    dramatic: '戏剧光',
    natural: '自然光',
    backlit: '背光',
    rim: '轮廓光',
  }
  const lightLabel = lightLabels[ir.lighting.type] || ir.lighting.type
  const lightDesc = [lightLabel, ir.lighting.direction, ir.lighting.colorTemp]
    .filter(Boolean)
    .join('，')
  parts.push(lightDesc)

  // 动作
  if (ir.action?.details) {
    parts.push(ir.action.details)
  }

  return parts.join(' | ')
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 编译 VP-IR 为目标模型的 prompt
 */
export function compilePrompt(ir: VisualPromptIR, model: SupportedModel = 'wan'): CompileResult {
  const trace: CompilationTrace = {
    sourceIR: true,
    modelGrammar: model,
    componentsExtracted: false,
    constraintCheckCount: 0,
    constraintViolations: 0,
    totalPromptChars: 0,
  }

  // Validation
  const validation = validateIR(ir)
  if (!validation.valid) {
    console.warn('[PromptCompiler] VP-IR 不完整，缺失字段:', validation.missing.join(', '))
  }

  // Get grammar
  const grammar = getGrammar(model)
  if (!grammar) {
    throw new Error(`不支持的模型: ${model}`)
  }

  // Extract components
  const components = extractComponents(ir)
  trace.componentsExtracted = true

  // Build prompt
  const modelReadyPrompt = grammar.promptBuilder(components)
  trace.totalPromptChars = modelReadyPrompt.length

  // Build negative
  const modelReadyNegative = compileNegative(ir, model)

  // Check constraints
  const violations = checkAllConstraints(modelReadyPrompt)
  trace.constraintCheckCount = violations.length
  trace.constraintViolations = violations.filter((v) => v.severity === 'error').length

  // Human summary
  const humanReadableSummary = buildHumanSummary(ir)

  return {
    modelReadyPrompt,
    modelReadyNegative,
    humanReadableSummary,
    violations,
    targetModel: model,
    trace,
  }
}

/**
 * 从 shot spec 快速编译（简化入口）
 */
export function compileShotPrompt(
  subject: string,
  sceneEnv: string,
  shotType: string,
  model: SupportedModel = 'wan',
): CompileResult {
  const ir: VisualPromptIR = {
    subject,
    scene: {
      environment: sceneEnv,
      timeOfDay: '',
      atmosphere: '',
    },
    camera: {
      shotType: (shotType as any) || 'medium',
      angle: '平视',
      lens: '50mm',
    },
    lighting: { type: 'natural' },
    style: { cinematicStyle: '写实' },
    constraints: { avoid: [], mustInclude: [] },
  }
  return compilePrompt(ir, model)
}
