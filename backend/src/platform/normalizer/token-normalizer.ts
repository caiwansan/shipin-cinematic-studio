/**
 * token-normalizer.ts — 统一 Token 统计
 *
 * 为不返回 token 用量或格式不标准的 Provider 提供估算/补全功能。
 */

import { StandardLLMResponse } from './types.js'

/**
 * 估算文本的 token 数（粗略，用于 provider_reported 缺失时的 fallback）
 * 中文约 0.6 token/字，英文约 0.25 token/字符
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  let count = 0
  for (const char of text) {
    // CJK 字符范围
    if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(char)) {
      count += 0.6
    } else {
      count += 0.25
    }
  }
  return Math.max(1, Math.ceil(count))
}

/**
 * 为缺失 token 信息的 StandardLLMResponse 补全估算值
 */
export function fillMissingTokens(
  response: StandardLLMResponse,
  inputText: string,
): StandardLLMResponse {
  if (response.tokens) return response

  const outputTokens = estimateTokenCount(response.content)
  const inputTokens = estimateTokenCount(inputText)

  return {
    ...response,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
      inputDetail: 'estimated',
      outputDetail: 'estimated',
    },
  }
}

/**
 * 合并分开报告的 input/output token 数
 */
export function mergeSeparateTokens(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): { input: number; output: number; total: number; inputDetail: 'provider_reported'; outputDetail: 'provider_reported' } {
  const input = inputTokens ?? 0
  const output = outputTokens ?? 0
  return {
    input,
    output,
    total: input + output,
    inputDetail: 'provider_reported',
    outputDetail: 'provider_reported',
  }
}
