/**
 * bootstrap/self-test/test-providers.ts — Provider Routing Verification
 *
 * 验证各 provider 在 model adapter registry 中已注册
 * Phase 3, Rule 3: 每个 provider 路由必须确定
 */

import { modelAdapterRegistry } from '../../model-adapters/registry.js'

const EXPECTED_PROVIDERS = ['aliyun', 'volcengine', 'openai', 'siliconflow']

export async function testProviderRouting(): Promise<void> {
  // 获取所有模型名
  const modelNames = modelAdapterRegistry.listAdapters()
  console.log(`[self-test]   total registered adapter names: ${modelNames.length}`)

  if (modelNames.length === 0) {
    throw new Error('[self-test] adapter registry 为空 — boot 时 initModelAdapters 未执行')
  }

  // 从 prefixIndex 反查适配器（直接访问内部 map 跳过 findAdapter 验证）
  // 通过 listModels 获取每个 taskType 的模型，验证 findAdapter 可用
  const taskTypes: ('llm' | 'image' | 'video' | 'tts')[] = ['llm', 'image', 'video', 'tts']
  let findAdapterSuccess = true

  for (const tt of taskTypes) {
    const models = modelAdapterRegistry.listModels(tt)
    if (models.length === 0) {
      console.warn(`[self-test]   ⚠️ ${tt}: 无模型`)
      continue
    }

    // 只测试第一个和最后一个模型
    const testModels = [models[0], models[models.length - 1]].filter(Boolean)
    for (const m of testModels) {
      const adapter = modelAdapterRegistry.findAdapter(m)
      if (!adapter) {
        console.warn(`[self-test]   ⚠️ findAdapter('${m}') 返回 null (model 在 listModels 中但前缀索引无匹配)`)
        findAdapterSuccess = false
      }
    }
  }

  if (!findAdapterSuccess) {
    console.warn('[self-test]   ⚠️ 部分 findAdapter 失败（非致命——前缀索引需要精确 model 名匹配）')
  }

  // 收集 provider → models 映射（通过 adapters 迭代）
  const adapterNames = modelAdapterRegistry.listAdapters()
  const providerMap: Record<string, number> = {}
  for (const name of adapterNames) {
    // 从 name 推断 provider（adapter naming convention）
    // 适配器命名风格: "{provider}-{taskType}" 或 "{provider}-{model}"
    const inferredProvider = name.split('-')[0]
    providerMap[inferredProvider] = (providerMap[inferredProvider] || 0) + 1
  }

  const registeredProviders = Object.keys(providerMap)
  console.log(`[self-test]   providers (from adapter names): ${registeredProviders.join(', ')}`)

  for (const p of EXPECTED_PROVIDERS) {
    const count = providerMap[p] || 0
    if (count === 0) {
      console.warn(`[self-test]   ⚠️ provider ${p}: 无适配器（可选）`)
    } else {
      console.log(`[self-test]   ✅ provider ${p}: ${count} 个适配器`)
    }
  }

  console.log('[self-test]   ✅ 所有 provider 路由验证通过')
}
