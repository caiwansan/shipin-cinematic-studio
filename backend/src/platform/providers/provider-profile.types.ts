/**
 * ProviderProfile — Provider 兼容性画像
 *
 * 统一描述每个 AI Provider 的特征，包括：
 * - 认证方式
 * - API 端点
 * - 响应格式
 * - Token 统计方式
 * - 响应/错误映射器
 */

import { StandardLLMResponse, StandardError } from '../normalizer/types.js'

export interface ProviderProfile {
  name: string
  displayName: string
  baseUrl: string
  models: string[]
  authentication: {
    type: 'bearer' | 'header' | 'custom'
    headerName?: string        // 例如 x-api-key
    extraHeaders?: Record<string, string>
  }
  endpoints: {
    chat: string               // 相对于 baseUrl 的路径
    stream?: string
  }
  responseFormat: 'openai' | 'anthropic' | 'gemini' | 'custom'
  tokenReporting: 'standard' | 'separate' | 'missing'
  /** 响应解析器: 将 provider 原始响应转为标准中间格式 */
  responseMapper?: (raw: any) => StandardLLMResponse
  /** 错误映射: 将 provider 原始错误转为标准错误码 */
  errorMapper?: (status: number, body: any) => StandardError
  rateLimit?: {
    rpm?: number
    tpm?: number
  }
  notes?: string
}
