// ============================================================
// DiscoveryProviderFactory — 根据 Feature Flag 创建 Provider
// 同时支持 Legacy и Engine2
// ============================================================

import type { DiscoveryProvider } from './discovery-provider.js'
import { LegacyMockProvider } from './legacy-mock-provider.js'
import { Engine2Provider } from './engine2-provider.js'

/** 环境变量或配置中心的 Feature Flag 名称 */
const FEATURE_FLAG = 'DISCOVERY_ENGINE'

/** 当前生效的 Provider */
let currentProvider: DiscoveryProvider | null = null
let currentVersion: 'v1' | 'v2' = 'v1'

export function getDiscoveryProvider(): DiscoveryProvider {
  const flag = (process.env[FEATURE_FLAG] || 'v1').toLowerCase()
  const desiredVersion: 'v1' | 'v2' = flag === 'v2' ? 'v2' : 'v1'

  if (!currentProvider || currentVersion !== desiredVersion) {
    currentVersion = desiredVersion

    if (desiredVersion === 'v2') {
      currentProvider = new Engine2Provider()
      console.log('[Discovery] Engine 2.0 activated')
    } else {
      currentProvider = new LegacyMockProvider()
      console.log('[Discovery] Legacy Mock engine active')
    }
  }

  return currentProvider
}

/** 强制重新解析 Feature Flag（用于运行时切换） */
export function refreshDiscoveryProvider(): DiscoveryProvider {
  currentProvider = null
  return getDiscoveryProvider()
}

/** 获取当前版本标识 */
export function getDiscoveryVersion(): 'v1' | 'v2' {
  return currentVersion
}
