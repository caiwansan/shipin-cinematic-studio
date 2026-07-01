// ============================================================
// AI Presence Engine — Index
// P0-T005: AI Presence Engine Foundation
// P0-T005.1: 12 Platform Extension — registered all 12 adapters
//
// Auto-registers all adapters and exports the singleton engine.
// ============================================================

import { providerAdapterRegistry } from './registry.js'
import { chatgptAdapter } from './adapters/chatgpt.js'
import { geminiAdapter } from './adapters/gemini.js'
import { claudeAdapter } from './adapters/claude.js'
import { deepseekAdapter } from './adapters/deepseek.js'
import { perplexityAdapter } from './adapters/perplexity.js'
import { copilotAdapter } from './adapters/copilot.js'
import { doubaoAdapter } from './adapters/doubao.js'
import { tongyiAdapter } from './adapters/tongyi.js'
import { wenxinAdapter } from './adapters/wenxin.js'
import { yuanbaoAdapter } from './adapters/yuanbao.js'
import { kimiAdapter } from './adapters/kimi.js'
import { xinghuoAdapter } from './adapters/xinghuo.js'
import { PresenceEngine } from './engine.js'

// Register all 12 adapters
providerAdapterRegistry.register(chatgptAdapter)
providerAdapterRegistry.register(geminiAdapter)
providerAdapterRegistry.register(claudeAdapter)
providerAdapterRegistry.register(deepseekAdapter)
providerAdapterRegistry.register(perplexityAdapter)
providerAdapterRegistry.register(copilotAdapter)
providerAdapterRegistry.register(doubaoAdapter)
providerAdapterRegistry.register(tongyiAdapter)
providerAdapterRegistry.register(wenxinAdapter)
providerAdapterRegistry.register(yuanbaoAdapter)
providerAdapterRegistry.register(kimiAdapter)
providerAdapterRegistry.register(xinghuoAdapter)

// Export singleton engine
export const presenceEngine = new PresenceEngine(providerAdapterRegistry)

export { ProviderAdapterRegistry } from './registry.js'
export { PresenceEngine } from './engine.js'
export { providerAdapterRegistry } from './registry.js'
export { CapabilityRegistry, capabilityRegistry } from './capability-registry.js'
export type { ProviderAdapter, ProviderAdapterMeta } from './adapter.interface.js'
export type { CapabilityInfo } from './capability-registry.js'
export type {
  PresenceContext,
  ProviderResult,
  AIPresenceResult,
  AIPresenceOverall,
  Visibility,
  EvidenceLevel,
  PlatformGroup,
} from './types.js'
