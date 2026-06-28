/**
 * bootstrap/preflight/adapters.ts — Adapter Registry 完整性校验
 *
 * 确保所有 taskType 至少有一个适配器
 */
import { modelAdapterRegistry } from '../../model-adapters/registry.js'

export function verifyAdapterRegistry(): void {
  const adapters = modelAdapterRegistry.listAdapters()
  if (adapters.length === 0) {
    throw new Error('[boot] 没有注册任何适配器')
  }

  const llmModels = modelAdapterRegistry.listModels('llm')
  const imageModels = modelAdapterRegistry.listModels('image')
  const videoModels = modelAdapterRegistry.listModels('video')
  const ttsModels = modelAdapterRegistry.listModels('tts')

  console.log(`[boot]   adapters: ${adapters.length} 个`)
  console.log(`[boot]   LLM models: ${llmModels.length} 个`)
  console.log(`[boot]   Image models: ${imageModels.length} 个`)
  console.log(`[boot]   Video models: ${videoModels.length} 个`)
  console.log(`[boot]   TTS models: ${ttsModels.length} 个`)

  if (llmModels.length === 0) {
    console.warn('[boot]   ⚠️ 未注册 LLM 模型适配器')
  }
  if (imageModels.length === 0) {
    console.warn('[boot]   ⚠️ 未注册 Image 模型适配器')
  }
  if (videoModels.length === 0 && ttsModels.length === 0) {
    console.warn('[boot]   ⚠️ 未注册 Video/TTS 模型适配器')
  }
}
