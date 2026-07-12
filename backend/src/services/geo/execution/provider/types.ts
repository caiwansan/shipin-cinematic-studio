// ============================================================
// RC2 — Provider 能力描述与注册类型
// ============================================================

import type { ProviderPolicy } from '../types'

// Provider 能力描述
export interface ProviderCapability {
  provider: string           // 'deepseek' | 'chatgpt' | ...
  capability: string         // 'reasoning' | 'search' | 'summary' | 'generation' | ...
  priority: number           // 优先级（低 = 优先）
  costPerToken: number
  averageLatency: number     // ms
  supportedPolicies: ProviderPolicy[]
  maxRetries: number
  timeout: number            // ms
}

// Provider 注册信息
export interface ProviderRegistration {
  provider: string
  capabilities: ProviderCapability[]
  enabled: boolean
  weight?: number            // 负载均衡权重
}

// Router 上下文（路由时可用的附加信息）
export interface RouterContext {
  brandId?: string
  tenantId?: string
  sourceType?: string
  routingHints?: Record<string, unknown>
}
