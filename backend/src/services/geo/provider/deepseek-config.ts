// ============================================================
// DeepSeek Provider Configuration
// RC2-T002: DeepSeek Discovery Provider
// ============================================================

export interface DeepSeekConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  timeoutMs: number
  /** Cost per 1K input tokens (¥) */
  inputCostPer1K: number
  /** Cost per 1K output tokens (¥) */
  outputCostPer1K: number
}

export const DEFAULT_DEEPSEEK_CONFIG: DeepSeekConfig = {
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/v1$/, '').replace(/\/$/, '') + '/v1',
  model: process.env.DEEPSEEK_MODEL || process.env.DEEPSEEK_LLM_MODEL || 'deepseek-v4-flash',
  temperature: 0.1,
  maxTokens: 4096,
  timeoutMs: 30000,
  // DeepSeek pricing (approximate, as of 2025):
  // deepseek-v4-flash: ¥0.14/1M input tokens, ¥0.28/1M output tokens
  // Stored as ¥ per 1K tokens (divide by 1000)
  inputCostPer1K: 0.00014,
  outputCostPer1K: 0.00028,
}

/**
 * Load DeepSeek config from environment variables with overrides.
 */
export function loadDeepSeekConfig(overrides?: Partial<DeepSeekConfig>): DeepSeekConfig {
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_CONFIG.baseUrl)
    .replace(/\/v1$/, '')
    .replace(/\/$/, '') + '/v1'

  return {
    ...DEFAULT_DEEPSEEK_CONFIG,
    baseUrl,
    apiKey: process.env.DEEPSEEK_API_KEY || DEFAULT_DEEPSEEK_CONFIG.apiKey,
    model: process.env.DEEPSEEK_MODEL || process.env.DEEPSEEK_LLM_MODEL || DEFAULT_DEEPSEEK_CONFIG.model,
    ...overrides,
  }
}

/**
 * Calculate cost based on token usage.
 * Returns cost in ¥.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  config?: DeepSeekConfig
): number {
  const cfg = config || DEFAULT_DEEPSEEK_CONFIG
  const inputCost = (inputTokens / 1000) * cfg.inputCostPer1K
  const outputCost = (outputTokens / 1000) * cfg.outputCostPer1K
  return Math.round((inputCost + outputCost) * 100000) / 100000
}
