// ============================================================
// LLM Client — KMKI-RUNTIME-002 (v2)
// 统一 LLM 调用接口，集成 OutputParser + UsageRecorder
// 支持 Retry
// ============================================================

import type { LLMRuntimeConfig } from './provider-resolver'
import { parseLLMOutput, safeParseJSON } from '../parser/output-parser'
import { usageRecorder } from '../usage/UsageRecorder'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: 'json_object' | 'text' }
  /** 重试次数，默认 2 */
  retryCount?: number
}

export interface LLMResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMCallOptions {
  userId?: string
  projectId?: string
  agent: string
  promptKey?: string
  promptVersion?: string
  traceId?: string
  workflowId?: string
  executionId?: string
}

/**
 * 调用 LLM，返回解析后的响应
 * 所有 provider 都走 OpenAI-compatible 接口
 * 自动 retry（默认 2 次）
 * 自动记录 usage
 */
export async function callLLM(
  config: LLMRuntimeConfig,
  request: LLMRequest,
  options?: LLMCallOptions,
): Promise<LLMResponse> {
  const { apiKey, baseUrl, model } = config
  const maxRetries = request.retryCount ?? 2

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const startTime = Date.now()
    try {
      const body: Record<string, any> = {
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }

      if (request.responseFormat?.type === 'json_object') {
        body.response_format = { type: 'json_object' }
      }

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })

      const latencyMs = Date.now() - startTime

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'unknown')
        const errorMsg = `LLM API error (${res.status}): ${errorText}`

        // Record failed usage
        if (options) {
          usageRecorder.record({
            ...options,
            provider: config.provider,
            model: config.model,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs,
            status: 'error',
            error: errorMsg,
          }).catch(() => {})
        }

        // Non-retryable status codes
        if (res.status === 401 || res.status === 403 || res.status === 400) {
          throw new Error(errorMsg)
        }

        if (attempt <= maxRetries) {
          const backoff = 1000 * Math.pow(2, attempt - 1)
          console.log(`[LLMClient] Retry ${attempt}/${maxRetries} after ${backoff}ms`)
          await new Promise((r) => setTimeout(r, backoff))
          lastError = new Error(errorMsg)
          continue
        }

        throw new Error(errorMsg)
      }

      const data = await res.json()
      const choice = data.choices?.[0]
      if (!choice?.message?.content) {
        throw new Error(`LLM returned empty response: ${JSON.stringify(data)}`)
      }

      const response: LLMResponse = {
        content: choice.message.content,
        model: data.model || model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      }

      // Record success usage
      if (options && response.usage) {
        usageRecorder.record({
          ...options,
          provider: config.provider,
          model: response.model,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          latencyMs,
          status: 'success',
        }).catch(() => {})
      }

      return response
    } catch (err: any) {
      lastError = err
      if (!err.message.includes('LLM API error')) {
        // Network / timeout errors — retryable
        if (attempt <= maxRetries) {
          const backoff = 1000 * Math.pow(2, attempt - 1)
          console.log(`[LLMClient] Retry ${attempt}/${maxRetries} after ${backoff}ms (${err.message})`)
          await new Promise((r) => setTimeout(r, backoff))
          continue
        }
      } else if (err.message.includes('401') || err.message.includes('403') || err.message.includes('400')) {
        // Auth errors — not retryable
        throw err
      }
    }
  }

  throw lastError || new Error('LLM call failed after all retries')
}

/**
 * 调用 LLM 并返回 JSON 解析后的对象（四级容错）
 * 不要求 response_format = json_object（自动容错）
 */
export async function callLLMJson<T = any>(
  config: LLMRuntimeConfig,
  request: LLMRequest,
  options?: LLMCallOptions,
): Promise<T> {
  const response = await callLLM(config, request, options)
  return safeParseJSON<T>(response.content, options?.promptKey || 'llm')
}
