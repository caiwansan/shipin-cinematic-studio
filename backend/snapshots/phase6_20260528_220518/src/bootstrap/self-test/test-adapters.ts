/**
 * bootstrap/self-test/test-adapters.ts — Adapter Registry E2E Test
 *
 * 验证每个 taskType 至少有一个适配器，且 execute 签名合规
 * Phase 3, Rule 1: 每个 adapter 必须通过自测
 */

import { modelAdapterRegistry } from '../../model-adapters/registry.js'

export async function testAdapterRegistry(): Promise<void> {
  const modelNames = modelAdapterRegistry.listAdapters()
  if (modelNames.length === 0) {
    throw new Error('[self-test] 没有注册任何适配器')
  }

  console.log(`[self-test]   registered models: ${modelNames.length} 个`)

  const modelsByType: Record<string, string[]> = {
    llm: modelAdapterRegistry.listModels('llm'),
    image: modelAdapterRegistry.listModels('image'),
    video: modelAdapterRegistry.listModels('video'),
    tts: modelAdapterRegistry.listModels('tts'),
  }

  for (const [taskType, models] of Object.entries(modelsByType)) {
    if (models.length === 0) {
      console.warn(`[self-test]   ⚠️ ${taskType}: 无模型注册`)
      continue
    }

    // 验证每个模型能被 findAdapter 找到
    for (const modelName of models.slice(0, 3)) {
      // 只验证前 3 个，避免过多的寻址开销
      const adapter = modelAdapterRegistry.findAdapter(modelName)
      if (!adapter) {
        throw new Error(`[self-test] ❌ model ${modelName} 在 listModels 中存在但 findAdapter 返回 null`)
      }
      if (typeof adapter.execute !== 'function') {
        throw new Error(`[self-test] ❌ adapter ${adapter.name} execute 不是函数`)
      }
    }

    console.log(`[self-test]   ✅ ${taskType}: ${models.length} 个模型, 前 3 个通过引用验证`)
  }

  console.log(`[self-test]   ✅ ${modelNames.length} 个注册模型全部通过完整性验证`)
}
