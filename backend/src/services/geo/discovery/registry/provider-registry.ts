// ============================================================
// Provider Registry — 管理所有 Provider 的注册和激活
// Adapter 内部使用，Discovery 无需感知
// ============================================================

export interface ProviderRegistration {
  name: string
  adapter: 'presence' | 'search' | 'knowledge'
  enabled: boolean
  config: Record<string, unknown>
}

export class ProviderRegistry {
  private providers: Map<string, ProviderRegistration> = new Map()

  register(reg: ProviderRegistration): void {
    this.providers.set(reg.name, reg)
  }

  get(name: string): ProviderRegistration | undefined {
    return this.providers.get(name)
  }

  getAll(): ProviderRegistration[] {
    return Array.from(this.providers.values())
  }

  getEnabled(adapter?: 'presence' | 'search' | 'knowledge'): ProviderRegistration[] {
    return this.getAll().filter(
      (p) => p.enabled && (!adapter || p.adapter === adapter),
    )
  }

  enable(name: string): void {
    const p = this.providers.get(name)
    if (p) p.enabled = true
  }

  disable(name: string): void {
    const p = this.providers.get(name)
    if (p) p.enabled = false
  }

  count(): number {
    return this.providers.size
  }
}

// 全局单例
export const providerRegistry = new ProviderRegistry()
