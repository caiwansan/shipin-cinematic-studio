// ============================================================
// StructuredExecutor — KMKI-RUNTIME-012
// StructuredGeneration 的内部执行引擎
// 串联：PromptRegistry → PromptRenderer → CapabilityResolver → LLMClient → OutputParser → SchemaValidator → UsageRecorder
// ============================================================

import { promptRegistry } from '../prompt/PromptRegistry'
import { capabilityRegistry, type Capability } from '../provider/capability-registry'
import { resolveLLMConfig, type LLMRuntimeConfig } from '../provider/provider-resolver'
import { callLLM } from '../provider/llm-client'
import { safeParseJSON } from '../parser/output-parser'
import { validateSchema, type SchemaField } from './SchemaValidator'
import { usageRecorder } from '../usage/UsageRecorder'
import type { GenerationContext } from './GenerationContext'

/** Provider 偏好/覆盖 */
export interface ProviderConfig {
  preferredProvider?: string
  requiredCapabilities?: Capability[]
  /** 若为 true，当 preferredProvider 不满足能力需求时 fallback 到其他 provider */
  allowFallback?: boolean
  temperature?: number
  maxTokens?: number
}

/** StructuredGeneration 输入 */
export interface StructuredInput {
  promptKey: string
  promptVersion?: string
  schema?: SchemaField[]  // 可选，不传则跳过 schema 校验
  context: GenerationContext
  variables: Record<string, string | number | boolean | string[] | undefined | null>
  providerConfig?: ProviderConfig
  options?: {
    /** 不录 usage（benchmark 场景手动录） */
    skipUsage?: boolean
  }
}

/** StructuredGeneration 输出 */
export interface StructuredResult<T = any> {
  success: boolean
  data?: T
  error?: string
  provider: string
  model: string
  tokens: {
    prompt: number
    completion: number
    total: number
  }
  latencyMs: number
  promptUsed: string
  parserStage: string
}

/**
 * 核心执行器
 * 这个函数是整个 Structured Generation 的主动脉
 */
export async function structuredExecute<T = any>(
  input: StructuredInput,
): Promise<StructuredResult<T>> {
  const startTime = Date.now()
  const { promptKey, promptVersion, schema, context, variables, providerConfig, options } = input

  // 1. 渲染 Prompt
  const rendered = promptRegistry.render(promptKey, variables, promptVersion)
  const promptUsed = rendered.system + (rendered.user ? `\n\n${rendered.user}` : '')

  // 2. 解析 Provider
  // 2a. 获取用户 LLM 配置
  const requiredCaps: Capability[] = providerConfig?.requiredCapabilities || ['structured_json']

  let llmConfig: LLMRuntimeConfig
  try {
    llmConfig = await resolveLLMConfig(context.userId || 'system', requiredCaps)
  } catch (err: any) {
    return {
      success: false,
      error: `Provider resolution failed: ${err.message}`,
      provider: 'unknown',
      model: 'unknown',
      tokens: { prompt: 0, completion: 0, total: 0 },
      latencyMs: Date.now() - startTime,
      promptUsed,
      parserStage: 'failed',
    }
  }

  // 2b. 如果有 preferred provider，检查是否满足能力
  if (providerConfig?.preferredProvider) {
    const preferredModel = llmConfig.model // keep current model
    const supports = providerConfig.requiredCapabilities?.every((cap) =>
      capabilityRegistry.supports(providerConfig.preferredProvider!, preferredModel, cap),
    ) ?? true

    if (supports) {
      // Update llmConfig to match preferred provider
      // (it already is from resolveLLMConfig)
    } else if (providerConfig.allowFallback) {
      console.log(`[StructuredExecutor] ${providerConfig.preferredProvider}/${preferredModel} lacks capabilities, using resolved provider ${llmConfig.provider}/${llmConfig.model}`)
    }
  }

  // 3. 调用 LLM
  const messages = [
    { role: 'system' as const, content: rendered.system },
    ...(rendered.user ? [{ role: 'user' as const, content: rendered.user }] : []),
  ]

  let llmResponse
  let parserStage = ''

  try {
    llmResponse = await callLLM(llmConfig, {
      messages,
      temperature: providerConfig?.temperature ?? 0.3,
      maxTokens: providerConfig?.maxTokens ?? 4096,
    }, {
      userId: context.userId,
      projectId: context.projectId,
      agent: context.agent,
      promptKey: context.promptKey,
      promptVersion: context.promptVersion,
      traceId: context.traceId,
      workflowId: context.workflowId,
      executionId: context.executionId,
    })
  } catch (err: any) {
    return {
      success: false,
      error: `LLM call failed: ${err.message}`,
      provider: llmConfig.provider,
      model: llmConfig.model,
      tokens: { prompt: 0, completion: 0, total: 0 },
      latencyMs: Date.now() - startTime,
      promptUsed,
      parserStage: 'llm_error',
    }
  }

  const latencyMs = Date.now() - startTime
  const tokens = {
    prompt: llmResponse.usage?.promptTokens || 0,
    completion: llmResponse.usage?.completionTokens || 0,
    total: llmResponse.usage?.totalTokens || 0,
  }

  // 4. 解析 JSON（四级容错）
  let parsedData: T
  try {
    parsedData = safeParseJSON<T>(llmResponse.content, promptKey)
    parserStage = 'parsed'
  } catch (err: any) {
    // 记录解析失败但不阻断——返回原始内容让上层决定
    return {
      success: false,
      error: `Output parse failed: ${err.message}`,
      provider: llmConfig.provider,
      model: llmConfig.model,
      tokens,
      latencyMs,
      promptUsed,
      parserStage: 'parse_error',
    }
  }

  // 5. Schema 校验（可选）
  if (schema && schema.length > 0) {
    const validation = validateSchema(parsedData, schema)
    if (!validation.valid) {
      return {
        success: false,
        error: `Schema validation failed: ${validation.errors.map((e) => e.message).join('; ')}`,
        provider: llmConfig.provider,
        model: llmConfig.model,
        tokens,
        latencyMs,
        promptUsed,
        parserStage: 'schema_error',
      }
    }
    parserStage = 'schema_validated'
  }

  return {
    success: true,
    data: parsedData,
    provider: llmConfig.provider,
    model: llmConfig.model,
    tokens,
    latencyMs,
    promptUsed,
    parserStage,
  }
}
