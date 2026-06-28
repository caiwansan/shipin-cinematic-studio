/**
 * model-adapters/llm/index.ts
 * LLM 模型适配器集合
 */

export { aliyunLlmAdapter } from './aliyun-llm.adapter.js'
export { volcengineLlmAdapter } from './volcengine-llm.adapter.js'
export { openaiCompatLlmAdapter } from './openai-compat.adapter.js'

import { modelAdapterRegistry } from '../registry.js'
import { aliyunLlmAdapter } from './aliyun-llm.adapter.js'
import { volcengineLlmAdapter } from './volcengine-llm.adapter.js'
import { openaiCompatLlmAdapter } from './openai-compat.adapter.js'

/** 注册所有 LLM 适配器 */
export function registerLlmAdapters(): void {
  modelAdapterRegistry.register(aliyunLlmAdapter)
  modelAdapterRegistry.register(volcengineLlmAdapter)
  modelAdapterRegistry.register(openaiCompatLlmAdapter)
}
