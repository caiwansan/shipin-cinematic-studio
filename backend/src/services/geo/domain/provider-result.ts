// ============================================================
// ProviderResult — 单个 Provider（如 DeepSeek）对特定 Adapter 的输出
// Adapter 内部使用，组装后以 DiscoveryResult 形式对外输出
// ============================================================

export interface ProviderResult {
  provider: string
  adapter: 'presence' | 'search' | 'knowledge'
  status: 'success' | 'partial' | 'failed'
  confidence: number
  data: Record<string, unknown>
  durationMs: number
  error?: string
}
