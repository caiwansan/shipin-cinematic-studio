/**
 * production-loop/provider-adapter-api.ts
 *
 * Phase 1.8 — Provider Adapter De-Legacyization
 *
 * ProviderAdapterAPI — 纯 API 调用层。
 *
 * 职责：
 *   1. 接收 ProviderNativePayload
 *   2. 自行决定如何结构化为 API 请求体
 *   3. 调用 Provider HTTP API
 *   4. 返回 ModelAdapterResult
 *
 * 职责外（禁止）：
 *   - 拼 prompt
 *   - 拼 narrative
 *   - 拼 effect string
 *
 * 一切文本编译由 ProviderPromptCompiler 完成。
 */

import type { ProviderNativePayload } from './provider-native-payload.js'
import type { ModelAdapterInput, ModelAdapterResult } from '../model-adapters/types.js'

/**
 * ProviderAdapterAPI 接口
 * 每个 Provider 实现此接口作为其 API 调用层
 */
export interface ProviderAdapterAPI {
  /** Provider 名称 */
  name: string

  /**
   * 核心调用方法
   * @param nativePayload 已编译的标准输入
   * @param input 原始 ModelAdapterInput（包含 imageUrl, duration 等非文本参数）
   * @param apiKey 已解密的 API Key
   * @param baseURL 自定义端点 URL
   * @returns ModelAdapterResult
   */
  send(nativePayload: ProviderNativePayload, input: ModelAdapterInput, apiKey: string, baseURL?: string): Promise<ModelAdapterResult>
}
