/**
 * utils/provider-api.ts — Provider API 客户端
 *
 * 封装所有 Provider Registry API 调用。
 * 前端唯一 Provider API 入口。
 *
 * 不存储 Provider 特定逻辑，只做 HTTP 调用。
 */

export interface ProviderMetadata {
  id: string
  name: string
  type: 'cloud' | 'local'
  baseURL: string
  icon?: string
  docsUrl?: string
  description?: string
  models: Array<{
    id: string
    capabilities: string[]
    defaultForCapability?: string
    contextWindow?: number
    description?: string
  }>
  requiresBaseURL?: boolean
}

export interface VerifyRequest {
  provider: string
  apiKey: string
  baseURL?: string
  model?: string
}

export interface VerifyResponse {
  success: boolean
  latency: number
  provider: string
  availableModels: string[]
  capabilities: string[]
  defaultModel: string
  errorCode?: string
  errorMessage?: string
}

export interface ConnectRequest {
  provider: string
  apiKey: string
  model?: string
  baseURL?: string
  taskType?: string
}

export interface ProviderStatus {
  configured: boolean
  count: number
  providers: Array<{
    provider: string
    taskType: string
    model: string
    configured: boolean
  }>
}

export interface TelemetryEvent {
  event: string
  timestamp: string
  provider?: string
  data?: Record<string, unknown>
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage?.getItem('auth_token') || ''
        : ''
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch {
    // SSR 安全
  }
  return headers
}

/** 列出所有支持的 Provider */
export async function listProviders(): Promise<ProviderMetadata[]> {
  const res = await fetch('/api/providers', {
    method: 'GET',
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`GET /api/providers failed: ${res.status}`)
  const data = await res.json()
  return data.providers || []
}

/** 获取单个 Provider 详情 */
export async function getProvider(id: string): Promise<ProviderMetadata> {
  const res = await fetch(`/api/providers/${id}`, {
    method: 'GET',
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`GET /api/providers/${id} failed: ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Unknown error')
  return data.provider
}

/** 按能力查询模型 */
export async function listModels(capability?: string): Promise<Array<{ id: string; capabilities: string[] }>> {
  const url = capability
    ? `/api/providers/models?capability=${encodeURIComponent(capability)}`
    : '/api/providers/models'
  const res = await fetch(url, { method: 'GET', headers: getHeaders() })
  if (!res.ok) throw new Error(`GET /api/providers/models failed: ${res.status}`)
  const data = await res.json()
  return data.models || []
}

/** 验证 API Key */
export async function verifyProvider(req: VerifyRequest): Promise<VerifyResponse> {
  const res = await fetch('/api/providers/verify', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`POST /api/providers/verify failed: ${res.status}`)
  return res.json()
}

/** 保存用户 Provider 配置 */
export async function connectProvider(req: ConnectRequest): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/providers/connect', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(req),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.errorMessage || `POST /api/providers/connect failed: ${res.status}`)
  }
  return data
}

/** 查询当前用户 Provider 配置状态 */
export async function getProviderStatus(): Promise<ProviderStatus> {
  const res = await fetch('/api/providers/status', {
    method: 'GET',
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`GET /api/providers/status failed: ${res.status}`)
  const data = await res.json()
  return data
}

/** 埋点：发送 FRE 事件 */
export async function sendFreEvent(event: string, provider?: string, extra?: Record<string, unknown>): Promise<void> {
  try {
    const payload: TelemetryEvent = {
      event,
      timestamp: new Date().toISOString(),
      provider,
      data: extra,
    }
    // 使用 navigator.sendBeacon 做无阻塞上报
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    navigator.sendBeacon?.('/api/tasks/telemetry', blob)
  } catch {
    // 埋点失败不影响主流程
  }
}
