/**
 * providers/index.ts — Provider 初始化入口
 *
 * 注册所有内置 Provider 到 ProviderRegistry。
 * 在服务器启动时调用。
 *
 * ⚠️ 新增 Provider 请在这里注册。
 */

import { providerRegistry } from '../runtime/provider-registry.js'
import { deepseekProvider } from './deepseek.provider.js'
import { volcengineProvider } from './volcengine.provider.js'
import { aliyunProvider } from './aliyun.provider.js'
import { siliconflowProvider } from './siliconflow.provider.js'
import { openaiProvider } from './openai.provider.js'

export function initProviders(): void {
  if (providerRegistry.isInitialized) {
    console.log('[ProviderRegistry] 已初始化，跳过')
    return
  }

  providerRegistry.register(deepseekProvider)
  providerRegistry.register(volcengineProvider)
  providerRegistry.register(aliyunProvider)
  providerRegistry.register(siliconflowProvider)
  providerRegistry.register(openaiProvider)

  providerRegistry.setInitialized()

  console.log(`[ProviderRegistry] ✅ ${providerRegistry.listProviders().length} 个 Provider 已注册`)
  for (const p of providerRegistry.listProviders()) {
    console.log(`  - ${p.name} (${p.id}): ${p.models.length} 模型, ${[...new Set(p.models.flatMap(m => m.capabilities))].join('/')}`)
  }
}

export { providerRegistry }
