/**
 * model-adapters/index.ts — 模型适配器矩阵入口
 *
 * 使用方式:
 *   import { modelAdapterRegistry } from './model-adapters/index.js'
 *
 *   // 注册完所有适配器后，统一调用:
 *   const result = await modelAdapterRegistry.execute('wan2.7-image-pro', {
 *     prompt: '...',
 *     apiKey: '...',
 *   })
 *
 * 新增模型适配器的步骤:
 *   1. 在 images/ 或 llm/ 或 video/ 下创建适配器文件
 *   2. 在对应 index.ts 中 export + register
 *   3. 完成
 */

export { ModelAdapterRegistry, modelAdapterRegistry } from './registry.js'
export type { ModelAdapter, ModelAdapterInput, ModelAdapterResult, AdapterEntry } from './types.js'
export type { RuntimePayload } from '../runtime/runtime-payload.js'

import { modelAdapterRegistry } from './registry.js'
import { registerImageAdapters } from './images/index.js'
import { registerLlmAdapters } from './llm/index.js'
import { registerVideoAdapters } from './video/index.js'
import { registerTtsAdapters } from './tts/index.js'

/**
 * 初始化所有模型适配器
 * 在应用启动时调用一次
 */
export function initModelAdapters(): void {
  registerImageAdapters()
  registerLlmAdapters()
  registerVideoAdapters()
  registerTtsAdapters()
  console.log(`[ModelAdapter] 初始化完成，已注册 ${modelAdapterRegistry.listAdapters().length} 个适配器`)
}

/**
 * 获取适配器矩阵支持的完整模型列表
 */
export function getSupportedModels(taskType?: 'llm' | 'image' | 'video' | 'tts'): string[] {
  return modelAdapterRegistry.listModels(taskType)
}
