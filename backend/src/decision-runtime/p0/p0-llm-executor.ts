/**
 * p0-llm-executor.ts — Phase LA-1B: LLM Execution Layer
 *
 * ============================================================
 * 执行面 — 把 P-0 的决策结果交给大模型生成真实回答
 *
 * 链路：
 *   U-1 Seed Matcher（分类 + 跟踪）
 *     ↓
 *   P-0 Gateway（Decision shell, 判断是否调 LLM）
 *     ↓
 *   p0-llm-executor（从 RouteConfig 选 Provider → 调用 LLM）
 *     ↓
 *   返回用户可见回答
 *
 * 控制面（selectProvider） ≠ 执行面（本文件）
 * 控制面只返回"选哪个 provider"的决策，
 * 执行面才真正调 API。
 * ============================================================
 */

import { getRouteConfig } from '../../utils/index.js'
import { decryptKey } from '../../services/crypto.service.js'

// 环境变量兜底：支持通过 LIFE_ASSISTANT_API_KEY 直接设置明文 API Key
// 优先级：环境变量 > DB 加密 Key
// 当 DB 中的加密 Key 因 CRYPTO_ENCRYPTION_KEY 变更而无法解密时使用此兜底
const FALLBACK_API_KEY = process.env.LIFE_ASSISTANT_API_KEY || ''

const SCOPE = 'platform:life-assistant'

interface PlatformLLMProvider {
  id: string
  name: string
  type: string
  apiKeyEncrypted?: string
  baseUrl: string
  models: string[]
  status: 'active' | 'disabled'
  priority: number
}

interface RoutingConfig {
  defaultProvider: string | null
  routingMode: 'priority' | 'fixed'
  modelTierMapping: {
    fast: string[]
    balanced: string[]
    quality: string[]
  }
}

/**
 * 从 RouteConfig 获取所有 active 的 provider（按 priority 升序排列）
 */
async function getActiveProviders(): Promise<PlatformLLMProvider[]> {
  const providers: PlatformLLMProvider[] = await getRouteConfig(SCOPE, 'providers', [])
  return providers.filter(p => p.status === 'active').sort((a, b) => a.priority - b.priority)
}

/**
 * 解析某个 provider 的 API Key
 * 优先级：环境变量 > DB 加密 Key
 */
function resolveApiKey(provider: PlatformLLMProvider): string | null {
  const envKey = process.env[`P0_LLM_KEY_${provider.type.toUpperCase()}`]
  if (envKey) return envKey

  if (provider.apiKeyEncrypted) {
    try {
      return decryptKey(provider.apiKeyEncrypted)
    } catch {
      return null
    }
  }
  return null
}

/**
 * 调用单个 provider
 */
async function callProvider(
  provider: PlatformLLMProvider,
  query: string,
  systemPrompt: string,
): Promise<{ content: string; provider: string; model: string }> {
  const apiKey = resolveApiKey(provider)
  if (!apiKey) {
    throw new Error(`[${provider.name}] 未配置有效 API Key`)
  }

  const model = provider.models?.[0] || 'gpt-4o-mini'
  const baseUrl = provider.baseUrl.replace(/\/+$/, '')
  const url = baseUrl.endsWith('/v1')
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/chat/completions`

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000), // 60s 超时
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`[${provider.name}] ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data: any = await resp.json()
  const content = data?.choices?.[0]?.message?.content || ''
  return { content, provider: provider.name, model }
}

/**
 * 构建 system prompt
 */
function buildSystemPrompt(seedContext?: {
  matchedSeed?: string | null
  matchLevel?: string
  domain?: string
} | null): string {
  const hasContext = seedContext?.matchedSeed && seedContext?.matchLevel && seedContext?.matchLevel !== 'none'
  if (hasContext) {
    return `你是一个智能生活助手。用户的问题涉及「${seedContext.domain || '日常生活'}」领域，命中了分类「${seedContext.matchedSeed}」（匹配度: ${seedContext.matchLevel}）。

请针对用户的问题给出真实、具体、有帮助的回答。回答要自然亲切、信息丰富，不要说自己是大模型，不要说自己是 AI。
如果用户问的是具体产品/服务评价，给出客观分析。如果用户问的是建议，给出具体可行的建议。如果是闲聊，自然应对。

回答控制在 200 字以内。`
  }
  return `你是一个智能生活助手。请针对用户的问题给出真实、具体、有帮助的回答。
回答要自然亲切、信息丰富，不要说自己是大模型，不要说自己是 AI。
如果是闲聊就自然应对。回答控制在 200 字以内。`
}

/**
 * 调大模型 — 有序失败转移（Failover Chain）
 *
 * 从 RouteConfig 中读取所有 active 的 provider，按 priority 升序依次尝试。
 * 第一个成功返回即停止；全部失败则抛出最后一个错误。
 *
 * @param query 用户输入的原始问题
 * @param seedContext U-1 匹配信息（如有），可为 null
 * @returns LLM 生成的回答
 */
export async function executeLLM(
  query: string,
  seedContext?: {
    matchedSeed?: string | null
    matchLevel?: string
    domain?: string
  } | null,
): Promise<{ content: string; provider: string; model: string }> {
  const providers = await getActiveProviders()

  if (providers.length === 0) {
    throw new Error('平台未配置可用的大模型 Provider，请在管理后台 → 平台 LLM 配置中添加并启用至少一个 Provider')
  }

  const systemPrompt = buildSystemPrompt(seedContext)
  let lastError: Error | null = null

  for (const provider of providers) {
    try {
      const result = await callProvider(provider, query, systemPrompt)
      return result
    } catch (err: any) {
      lastError = err
      console.warn(`[P0-LLM] ${provider.name} 调用失败，尝试下一个:`, err.message)
    }
  }

  // 所有 provider 都失败
  throw new Error(
    `所有大模型均已尝试，全部失败。共 ${providers.length} 个 Provider。最后错误: ${lastError?.message || '未知'}`
  )
}

/**
 * 列出所有 active provider（用于前端展示 failover 链路状态）
 */
export async function getActiveLLMProviders(): Promise<Array<{ name: string; type: string; priority: number }>> {
  const providers = await getActiveProviders()
  return providers.map(p => ({ name: p.name, type: p.type, priority: p.priority }))
}
