/**
 * runtime/runtime-gateway.ts — Runtime Gateway v2
 *
 * ═══════════════════════════════════════════════════════════════════
 * 全系统唯一执行入口
 *
 * 职责:
 *   1. 解析运行时配置（resolveRuntimeConfig）
 *   2. 注入 RuntimeContext
 *   3. 路由到对应 Provider
 *   4. 收集执行 trace
 *   5. 返回统一 Result
 *
 * 禁止绕过:
 *   - routes/ 下代码不得直接 import provider
 *   - queue/ 下代码不得自行读 process.env
 *   所有执行必须经由此 Gateway
 * ═══════════════════════════════════════════════════════════════════
 */

import { getRuntimeContext, withRuntimeContext, createContext, type RuntimeContext } from '../services/runtime-context.js'
import { resolveRuntimeConfig, type ResolvedRuntimeConfig } from './resolveRuntimeConfig.js'
import type { V2Input, V2Result } from '../providers/provider.interface.v2.js'

// ─── 执行 Trace ────────────────────────────────────────────────────

export interface ExecutionTrace {
  executionId: string
  capability: string
  input: Record<string, unknown>
  resolvedConfig: ResolvedRuntimeConfig
  startedAt: number
  completedAt?: number
  result?: V2Result
  error?: string
  duration?: number
}

const executionTraces: ExecutionTrace[] = []
const MAX_TRACES = 1000

// ─── Gateway 执行 ──────────────────────────────────────────────────

export async function executeViaGateway(
  capability: 'llm' | 'image' | 'video' | 'tts',
  input: V2Input,
  options?: {
    userId?: string
    provider?: string
    model?: string
    tenantId?: string      // Sprint-06A: 企业 ID → EnterpriseLlmConfig
    businessType?: string  // Sprint-06A: 平台业务类型 → admin-global-config
  }
): Promise<V2Result> {
  // 1. 解析运行时配置
  const config = await resolveRuntimeConfig(capability, {
    model: options?.model || input.model as string,
    provider: options?.provider || input.provider as string,
    userId: options?.userId,
    tenantId: options?.tenantId,
    businessType: options?.businessType,
  })

  // 2. 创建/注入 RuntimeContext
  const existingCtx = getRuntimeContext()
  const ctx = existingCtx || createContext({
    userId: config.userId,
    provider: {
      name: config.provider,
      model: config.model,
      source: config.source.apiKey === 'user_config' ? 'BYOK'
           : config.source.apiKey === 'enterprise_config' ? 'ENTERPRISE'
           : config.source.apiKey === 'platform_config' ? 'PLATFORM'
           : 'SYSTEM',
    },
  })

  // 3. 用 context 执行
  return withRuntimeContext(ctx, async () => {
    const trace: ExecutionTrace = {
      executionId: ctx.executionId,
      capability,
      input: { ...input },
      resolvedConfig: config,
      startedAt: Date.now(),
    }

    try {
      // 路由到对应 provider
      const result = await routeToProvider(capability, config, input)
      trace.result = result
      trace.completedAt = Date.now()
      trace.duration = trace.completedAt - trace.startedAt
      return result
    } catch (e: any) {
      trace.error = e.message
      trace.completedAt = Date.now()
      trace.duration = trace.completedAt - trace.startedAt
      throw e
    } finally {
      executionTraces.unshift(trace)
      if (executionTraces.length > MAX_TRACES) executionTraces.pop()
    }
  })
}

// ─── Provider 路由 ─────────────────────────────────────────────────

async function routeToProvider(
  capability: 'llm' | 'image' | 'video' | 'tts',
  config: ResolvedRuntimeConfig,
  input: V2Input
): Promise<V2Result> {
  const { provider, model, apiKey, baseUrl } = config

  // 根据 capability + provider 路由到对应的底层 provider
  switch (capability) {
    case 'llm':
      return callLLM(provider, config, input)

    case 'image':
      return callImage(provider, config, input)

    case 'video':
      return callVideo(provider, config, input)

    case 'tts':
      return callTTS(provider, config, input)

    default:
      throw new Error(`不支持的 capability: ${capability}`)
  }
}

// ─── LLM 调用 ──────────────────────────────────────────────────────

async function callLLM(provider: string, config: ResolvedRuntimeConfig, input: V2Input): Promise<V2Result> {
  const { model, apiKey, baseUrl } = config
  const messages = input.systemPrompt
    ? [{ role: 'system', content: input.systemPrompt }, { role: 'user', content: input.prompt || input.text || '' }]
    : [{ role: 'user', content: input.prompt || input.text || '' }]

  // OpenAI 兼容格式
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 4096,
    }),
    signal: AbortSignal.timeout(config.timeout),
  })

  if (!resp.ok) {
    const err = await resp.text()
    // 兼容模式失败，有些 provider 需要原生 endpoint
    if (resp.status === 404 && (provider === 'aliyun' || provider === 'bailian')) {
      return callBailianNativeLLM(config, input)
    }
    throw new Error(`${config.providerLabel} LLM 调用失败 (${resp.status}): ${err}`)
  }

  const data = await resp.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    totalTokens: data.usage?.total_tokens,
  }
}

// 阿里百炼原生 LLM 端点
async function callBailianNativeLLM(config: ResolvedRuntimeConfig, input: V2Input): Promise<V2Result> {
  const nativeEndpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
  const resp = await fetch(nativeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      input: {
        messages: [
          { role: 'user', content: [{ text: input.prompt || input.text || '' }] }
        ]
      },
      parameters: {
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 4096,
      },
    }),
    signal: AbortSignal.timeout(config.timeout),
  })
  if (!resp.ok) throw new Error(`阿里百炼 LLM 原生调用失败 (${resp.status}): ${await resp.text()}`)
  const data = await resp.json()
  const content = data?.output?.choices?.[0]?.message?.content?.[0]?.text || data?.output?.text || ''
  return { content }
}

// ─── Image 调用 ────────────────────────────────────────────────────

async function callImage(provider: string, config: ResolvedRuntimeConfig, input: V2Input): Promise<V2Result> {
  const { model, apiKey, baseUrl } = config
  const size = input.size || input.aspectRatio ? aspectRatioToSize(input.aspectRatio!) : '1024x1024'

  // 尝试 OpenAI 兼容格式
  const body: any = { model, prompt: input.prompt || input.text || '', n: input.n || 1, size }
  if (input.negativePrompt) body.negative_prompt = input.negativePrompt
  if (input.imageUrl) body.image = input.imageUrl
  if (!input.imageUrl && input.referenceImage) body.image = input.referenceImage

  const resp = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout),
  })

  if (!resp.ok) {
    const err = await resp.text()
    // 兼容模式失败 → 尝试百炼多模态端点
    if (resp.status === 404 && (provider === 'aliyun' || provider === 'bailian')) {
      return callBailianNativeImage(config, input)
    }
    throw new Error(`${config.providerLabel} 图片生成失败 (${resp.status}): ${err}`)
  }

  const data = await resp.json()
  if (Array.isArray(data.data) && data.data[0]?.url) {
    return { url: data.data[0].url, seed: data.data[0]?.seed, provider }
  }
  throw new Error(`${config.providerLabel} 图片响应异常: ${JSON.stringify(data).substring(0, 200)}`)
}

// 百炼多模态图片生成端点
async function callBailianNativeImage(config: ResolvedRuntimeConfig, input: V2Input): Promise<V2Result> {
  const endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      input: {
        messages: [
          { role: 'user', content: [{ text: input.prompt || input.text || '' }] }
        ]
      },
      parameters: { size: input.size || '1024x1024' },
    }),
    signal: AbortSignal.timeout(config.timeout),
  })
  if (!resp.ok) throw new Error(`阿里百炼多模态图片失败 (${resp.status}): ${await resp.text()}`)
  const data = await resp.json()
  const content = data?.output?.choices?.[0]?.message?.content || []
  for (const item of content) {
    if (item.image) return { url: item.image, seed: data.usage?.seed, provider: 'bailian' }
  }
  throw new Error(`阿里百炼多模态图片响应异常: ${JSON.stringify(data).substring(0, 200)}`)
}

// ─── Video 调用 → ModelAdapterRegistry ─────────────────────────────────────

async function callVideo(provider: string, config: ResolvedRuntimeConfig, input: V2Input): Promise<V2Result> {
  const { VideoAdapter } = await import('./adapters/video/VideoAdapter.js')
  const adapter = new VideoAdapter()
  const result = await adapter.execute(config.userId, {
    prompt: input.prompt || input.text || input.narrative || '',
    duration: input.duration || 5,
    model: config.model,
    imageUrl: input.imageUrl || input.firstFrameUrl || '',
    size: input.aspectRatio || input.ratio || '9:16',
    style: input.style || '',
  })
  return { taskId: result.taskId || result.videoUrl, status: 'submitted', provider }
}

// ─── TTS 调用 → ModelAdapterRegistry ──────────────────────────────────────

async function callTTS(provider: string, config: ResolvedRuntimeConfig, input: V2Input): Promise<V2Result> {
  const { TTSAdapter } = await import('./adapters/tts/TTSAdapter.js')
  const adapter = new TTSAdapter()
  const result = await adapter.execute(config.userId, {
    text: input.text || input.prompt || '',
    voice: input.voice || 'zh_female_warm',
    speed: input.speed || 1.0,
    model: config.model,
  })
  return { url: result.audioUrl, duration: 0, provider }
}

// ─── 工具 ──────────────────────────────────────────────────────────

function aspectRatioToSize(ratio: string): string {
  const map: Record<string, string> = {
    '16:9': '1920x1080',
    '9:16': '1080x1920',
    '1:1': '1024x1024',
    '4:3': '1024x768',
    '3:4': '768x1024',
  }
  return map[ratio] || '1024x1024'
}

// ─── Gateway API ───────────────────────────────────────────────────

export const runtimeGateway = {
  execute: executeViaGateway,
  getTraces: (limit: number = 50): ExecutionTrace[] => executionTraces.slice(0, limit),
  clearTraces: () => { executionTraces.length = 0 },
}
