/**
 * creative-os-gateway/index.ts
 *
 * ⚔️ Phase 6 — Creative OS Gateway（唯一出口）
 *
 * 所有外部请求必须：
 *   User → Gateway → Orchestrator → Director → Compiler
 *
 * 禁止 bypass Gateway。
 * Gateway 是 OS 的外部入口点。
 */

import type { DirectorPlan } from '../director-runtime/types.js'
import type { VideoBlueprint } from '../types/video-blueprint.js'
import type { StyleProfile } from '../style-runtime/style-registry.js'
import type { DirectorProfile } from '../director-registry/index.js'
import type { ExecutionPlan } from '../control-layer/orchestrator.js'
import type { PluginInput, PluginOutput } from '../plugin-sandbox/index.js'
import type { CreativeValueScore } from '../creative-economy/value-function.js'

// ── OS 请求 ──

export interface OSRequest {
  /** 用户意图 */
  userIntent: string
  /** 叙事类型 */
  narrativeType: string
  /** 风格 DSL（可选） */
  styleDSL?: string
  /** Director ID（可选，为空则自动匹配） */
  directorId?: string
  /** 插件 ID 列表（可选） */
  plugins?: string[]
  /** 上下文 */
  context: {
    projectId?: string
    sceneCount?: number
    userId?: string
  }
}

// ── OS 响应 ──

export interface OSResponse {
  /** 执行计划 */
  executionPlan: ExecutionPlan | null
  /** DirectorPlan */
  plan: DirectorPlan | null
  /** Blueprint（如已编译） */
  blueprint: VideoBlueprint | null
  /** 风格 */
  style: StyleProfile | null
  /** 创作价值评分 */
  valueScore: CreativeValueScore | null
  /** 日志 */
  log: string[]
  /** 错误 */
  error?: string
  /** 成功 */
  success: boolean
}

// ── 构建 PluginInput ──

function buildPluginInput(request: OSRequest, plan: DirectorPlan | null): PluginInput {
  return {
    userIntent: request.userIntent,
    directorPlan: plan,
    styleHints: request.styleDSL ? [request.styleDSL] : [],
    meta: {
      narrativeType: request.narrativeType,
      sceneCount: request.context.sceneCount,
      projectId: request.context.projectId,
    },
  }
}

// ── Gateway 处理 ──

/**
 * processRequest — OS Gateway 入口
 *
 * 流程：
 *   1. 执行插件（如果指定）
 *   2. 匹配 Director（市场 or Registry）
 *   3. 解析 Style DSL
 *   4. 调用 Orchestrator
 *   5. 返回结果
 */
export async function processRequest(
  request: OSRequest,
  deps: {
    compileWithStyle: (plan: DirectorPlan, graph: unknown, style?: StyleProfile) => VideoBlueprint
    orchestrate: (director: DirectorProfile, style: StyleProfile, plan: DirectorPlan, originalPlan?: DirectorPlan) => ExecutionPlan
    executePlugin: (pluginId: string, input: PluginInput) => Promise<PluginOutput>
    matchDirector: (narrativeType: string) => DirectorProfile | undefined
    compileDSL: (dsl: string) => StyleProfile
    analyze: (userIntent: string) => { plan: DirectorPlan; graph: unknown }
    evaluateCreativeValue: (plan: DirectorPlan, blueprint?: VideoBlueprint) => CreativeValueScore
    recordScore: (directorId: string, score: CreativeValueScore, projectId?: string) => unknown
  }
): Promise<OSResponse> {
  const log: string[] = []
  log.push(`[GATEWAY] 收到请求: ${request.userIntent.slice(0, 30)}...`)

  try {
    // Step 1: 执行插件
    let modifiedIntent = request.userIntent
    let styleDSLFragments: string[] = request.styleDSL ? [request.styleDSL] : []

    if (request.plugins && request.plugins.length > 0) {
      log.push(`[GATEWAY] 执行 ${request.plugins.length} 个插件...`)
      for (const pluginId of request.plugins) {
        const pluginInput = buildPluginInput({ ...request, userIntent: modifiedIntent }, null)
        const pluginOutput = await deps.executePlugin(pluginId, pluginInput)

        if (pluginOutput.modifiedIntent) {
          modifiedIntent = pluginOutput.modifiedIntent
          log.push(`[GATEWAY] 插件 ${pluginId} 修改了意图`)
        }
        if (pluginOutput.styleDSLFragments) {
          styleDSLFragments.push(...pluginOutput.styleDSLFragments)
          log.push(`[GATEWAY] 插件 ${pluginId} 添加了风格片段`)
        }

        log.push(...pluginOutput.log.map(l => `[PLUGIN:${pluginId}] ${l}`))
      }
    }

    // Step 2: 匹配 Director
    const director = deps.matchDirector(request.narrativeType)
    if (!director) {
      throw new Error(`未找到匹配 ${request.narrativeType} 的 Director`)
    }
    log.push(`[GATEWAY] 匹配 Director: ${director.name}`)

    // Step 3: 调用 Director analyze
    const { plan, graph } = deps.analyze(modifiedIntent)
    log.push(`[GATEWAY] Director 完成规划: ${plan.sceneSegmentation.length} 个场景段`)

    // Step 4: 解析 Style DSL
    const combinedDSL = styleDSLFragments.join(' ')
    let style: StyleProfile
    if (combinedDSL) {
      style = deps.compileDSL(combinedDSL)
      log.push(`[GATEWAY] 风格 DSL 编译完成: ${style.displayName}`)
    } else {
      // 默认风格
      style = {
        name: 'cinematic',
        displayName: '电影感',
        description: '默认电影风格',
        lightingBias: { dominant: 'natural', contrast: 'medium', description: '自然光' },
        colorPalette: { primaryHue: '中性色', saturation: 'neutral', temperature: 'neutral', description: '中性色彩' },
        lensPreference: { dominant: 'standard', movement: 'smooth', depth: 'medium', description: '标准镜头' },
        pacingModifier: { offset: 0, description: '标准节奏' },
      }
      log.push(`[GATEWAY] 使用默认风格: 电影感`)
    }

    // Step 5: Orchestrate
    const executionPlan = deps.orchestrate(director, style, plan)
    log.push(`[GATEWAY] Orchestrator 验证通过: ${executionPlan.compatibility.valid ? '兼容' : '有警告'}`)

    if (executionPlan.compatibility.warnings.length > 0) {
      log.push(`[GATEWAY] 警告: ${executionPlan.compatibility.warnings.join('; ')}`)
    }

    // Step 6: 编译 Blueprint（含 Style）
    const blueprint = deps.compileWithStyle(plan, graph, style)
    log.push(`[GATEWAY] Blueprint 编译完成`)

    // Step 7: Phase 7 — 创作价值评估
    const valueScore = deps.evaluateCreativeValue(plan, blueprint)
    log.push(`[GATEWAY] 创作价值评分: ${valueScore.grade} (${valueScore.total}/100)`)

    // Step 8: Phase 7 — 记录 Director 激励评分
    deps.recordScore(director.id, valueScore, request.context.projectId)
    log.push(`[GATEWAY] Director 激励已记录: ${director.id}`)

    return {
      executionPlan,
      plan,
      blueprint,
      style,
      valueScore,
      log,
      success: true,
    }
  } catch (e) {
    const errMsg = (e as Error).message
    log.push(`[GATEWAY] 错误: ${errMsg}`)
    return {
      executionPlan: null,
      plan: null,
      blueprint: null,
      style: null,
      valueScore: null,
      log,
      error: errMsg,
      success: false,
    }
  }
}
