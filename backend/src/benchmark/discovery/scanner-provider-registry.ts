// ============================================================
// ScannerProviderRegistry — 发现引擎 Provider 可插拔架构
// Discovery Engine 通过此 Registry 调用 Provider
// 配置 DISCOVERY_PROVIDER 切换适配器
// ============================================================

import { MockScanner } from './mock-scanner'

/** Scan 结果 */
export interface ScanResult {
  scenarios: Array<{
    scenarioId: string
    scenarioName: string
    industryId: string
    entityCoverage: boolean
    coverageScore: number
    confidence: number
    trend: 'up' | 'stable' | 'down'
  }>
  coverage: number
  share: number
  position: number
}

/** Scan 参数 */
export interface ScanContext {
  entity: string
  industry?: string
  description?: string
  website?: string
  matchConfidences: Map<string, number>
}

/** 扫描 Provider 接口 */
export interface ScannerProvider {
  readonly name: string
  scan(context: ScanContext): Promise<ScanResult> | ScanResult
}

/**
 * Provider Registry — 按配置选择 Scanner
 * 当前默认使用 MockScanner，后续可通过环境变量切换
 *   DISCOVERY_PROVIDER=mock       → MockScanner
 *   DISCOVERY_PROVIDER=openai     → OpenAIScanner（待实现）
 *   DISCOVERY_PROVIDER=deepseek   → DeepSeekScanner（待实现）
 */
export class ScannerProviderRegistry {
  private providers = new Map<string, ScannerProvider>()
  private defaultProvider: string

  constructor(defaultProvider?: string) {
    this.defaultProvider = defaultProvider || process.env.DISCOVERY_PROVIDER || 'mock'
    this.register('mock', new MockScannerAdapter())
  }

  register(name: string, provider: ScannerProvider): void {
    this.providers.set(name, provider)
  }

  getProvider(name?: string): ScannerProvider {
    const key = name || this.defaultProvider
    const provider = this.providers.get(key)
    if (!provider) {
      console.warn(`[ScannerProviderRegistry] Provider "${key}" not found, falling back to mock`)
      return this.providers.get('mock')!
    }
    return provider
  }

  async scan(context: ScanContext, providerName?: string): Promise<ScanResult> {
    const provider = this.getProvider(providerName)
    return provider.scan(context)
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }
}

/**
 * MockScanner 适配器 — 封装现有 MockScanner 为 ScannerProvider
 */
class MockScannerAdapter implements ScannerProvider {
  readonly name = 'mock'
  private inner = new MockScanner()

  scan(context: ScanContext): ScanResult {
    const { scenarios, coverage, share, position } = this.inner.scan(
      context.entity,
      context.matchConfidences,
    )
    return { scenarios, coverage, share, position }
  }
}

/** Singleton */
export const scannerProviderRegistry = new ScannerProviderRegistry()
