/**
 * Presence Executor — Platform AI 统一调用入口
 *
 * Hybrid AI Runtime Architecture:
 *   Presence Engine 的所有 AI 调用通过此 Executor 统一走 Platform Runtime。
 *   不再使用 process.env 或用户配置的 API Key。
 *
 * 所有 Presence Adapter 只需提供 prompt 和 provider 名称，
 * Executor 负责：
 *   1. 从 Platform Provider Pool 获取凭证
 *   2. 通过 PlatformRuntimeService.callLLM() 执行
 *   3. 统计用量
 *   4. 失败降级（不抛错）
 */

import { platformRuntimeService } from '../../../runtime/platform/platform-runtime.service.js'

export interface PresenceCallParams {
  provider: string
  systemPrompt?: string
  userPrompt?: string
  messages?: Array<{ role: string; content: string }>  // 兼容旧 adapter 调用
  maxTokens?: number
  temperature?: number
}

export interface PresenceCallResult {
  content: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  success: boolean
  errorMessage?: string
}

/**
 * 执行 Presence AI 调用
 * 如果 Platform Provider 不可用，静默降级返回空内容
 */
export async function executePresenceCall(params: PresenceCallParams): Promise<PresenceCallResult> {
  const { provider, systemPrompt, userPrompt, messages: rawMessages, maxTokens, temperature } = params

  // 兼容旧 adapter：如果传了 messages 数组，从中提取 system/user prompt
  const msg = rawMessages || []
  const effectiveSystemPrompt = systemPrompt || msg.find(m => m.role === 'system')?.content || ''
  const effectiveUserPrompt = userPrompt || msg.find(m => m.role === 'user')?.content || ''

  try {
    // 25秒超时保护 — 国内大模型响应较慢（通义、文心等常需 10-20秒）
    const timeoutMs = 25000
    const result = await Promise.race([
      platformRuntimeService.callLLM({
        provider,
        messages: [
          ...(effectiveSystemPrompt ? [{ role: 'system' as const, content: effectiveSystemPrompt }] : []),
          { role: 'user' as const, content: effectiveUserPrompt },
        ],
        maxTokens: maxTokens || 1024,
        temperature: temperature ?? 0.3,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${provider} 请求超时 ${timeoutMs}ms`)), timeoutMs)
      ),
    ]).catch((err) => {
      console.error(`[PresenceExecutor] ${provider} 调用失败:`, err.message)
      throw err
    })

    return {
      content: result.content,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs: result.latencyMs,
      success: true,
    }
  } catch (err: any) {
    // 静默降级 — Presence 扫描不因单个 Provider 失败而中断
    return {
      content: '',
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      success: false,
      errorMessage: err.message,
    }
  }
}
