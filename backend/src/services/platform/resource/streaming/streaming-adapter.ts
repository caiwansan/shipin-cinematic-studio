// ============================================================
// Streaming Adapter — adapt different provider streaming interfaces
// KMKI-PLAT-008
// ============================================================

import type { ResourceContract, ResourceCredential, StreamingChunk } from '../types'
import { registerStreamAdapter } from './streaming-interface'

/**
 * Generic HTTP SSE (Server-Sent Events) adapter.
 * Most OpenAI-compatible APIs use this format.
 */
async function* openAICompatibleStreamAdapter(
  resource: ResourceContract,
  credential: ResourceCredential,
  input: Record<string, any>,
): AsyncGenerator<StreamingChunk, void, undefined> {
  const endpointsStr = resource.endpoints || '{}'
  let baseUrl = ''
  try {
    baseUrl = JSON.parse(endpointsStr).baseUrl || ''
  } catch {}
  const endpoint = credential.endpoint || baseUrl
  const modelsStr = resource.models || '[]'
  let modelList: string[] = []
  try {
    modelList = JSON.parse(modelsStr)
  } catch {}
  const model = input.model || (modelList[0] || '')
  const apiKey = ''  // Must be injected by the caller — use credentialVault.resolve()

  const url = endpoint ? `${endpoint}/v1/chat/completions` : `https://api.openai.com/v1/chat/completions`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: input.messages || [],
        stream: true,
        ...(input.parameters || {}),
      }),
    })

    if (!response.ok) {
      yield {
        id: `error-${Date.now()}`,
        type: 'error',
        data: { status: response.status, statusText: response.statusText },
        timestamp: new Date().toISOString(),
      }
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      yield {
        id: `error-${Date.now()}`,
        type: 'error',
        data: { message: 'No response body' },
        timestamp: new Date().toISOString(),
      }
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            yield {
              id: `done-${Date.now()}`,
              type: 'done',
              data: {},
              timestamp: new Date().toISOString(),
            }
            return
          }
          try {
            const parsed = JSON.parse(data)
            yield {
              id: `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'text',
              data: parsed,
              timestamp: new Date().toISOString(),
              metadata: { model, vendor: resource.vendor },
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    yield {
      id: `done-${Date.now()}`,
      type: 'done',
      data: {},
      timestamp: new Date().toISOString(),
    }
  } catch (err: any) {
    yield {
      id: `error-${Date.now()}`,
      type: 'error',
      data: { message: err.message },
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Register default adapters.
 */
export function registerDefaultAdapters(): void {
  registerStreamAdapter('openai', openAICompatibleStreamAdapter)
  registerStreamAdapter('deepseek', openAICompatibleStreamAdapter)
  registerStreamAdapter('siliconflow', openAICompatibleStreamAdapter)
  registerStreamAdapter('qwen', openAICompatibleStreamAdapter)
  registerStreamAdapter('volcengine', openAICompatibleStreamAdapter)
  registerStreamAdapter('ollama', openAICompatibleStreamAdapter)
  console.log('[StreamingAdapter] Registered default streaming adapters for 6 vendors')
}

export { openAICompatibleStreamAdapter }
