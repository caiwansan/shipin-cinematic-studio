/**
 * benchmark/provider/registry.ts — Provider 注册中心
 *
 * 所有 AI 模型适配器统一注册，Runner 通过 name 查找。
 * 禁止在 Runner 中写 if(provider==="deepseek")。
 * 新增 Provider 只需实现 BenchmarkProvider 接口并注册。
 */
import { BenchmarkProvider } from '../types'

export class ProviderRegistry {
  private providers = new Map<string, BenchmarkProvider>()

  register(provider: BenchmarkProvider): void {
    const key = `${provider.name}@${provider.model}`
    this.providers.set(key, provider)
    console.log(`[provider-registry] ✅ Registered ${key}`)
  }

  get(name: string, model: string): BenchmarkProvider {
    const key = `${name}@${model}`
    const provider = this.providers.get(key)
    if (!provider) {
      throw new Error(`Provider not found: ${key}. Available: ${[...this.providers.keys()].join(', ')}`)
    }
    return provider
  }

  list(): string[] {
    return [...this.providers.keys()]
  }
}
