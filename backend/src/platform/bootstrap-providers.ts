/**
 * bootstrap-providers.ts — 初始化 Provider 注册表
 *
 * 应用启动时调用，注册所有内置 Provider Profile。
 * 确保在 UnifiedAIGateway / PlatformRuntimeService 使用前调用。
 */

import { registerAll } from './providers/provider-registry.js'
import {
  openaiProfile,
  deepseekProfile,
  doubaoProfile,
  tongyiProfile,
  wenxinProfile,
  yuanbaoProfile,
  kimiProfile,
  xinghuoProfile,
  claudeProfile,
  geminiProfile,
  perplexityProfile,
} from './providers/profiles/index.js'

export function bootstrapProviders(): void {
  registerAll([
    openaiProfile,
    deepseekProfile,
    doubaoProfile,
    tongyiProfile,
    wenxinProfile,
    yuanbaoProfile,
    kimiProfile,
    xinghuoProfile,
    claudeProfile,
    geminiProfile,
    perplexityProfile,
  ])
}
