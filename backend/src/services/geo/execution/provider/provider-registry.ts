// ============================================================
// RC2 — ProviderRegistry
// 能力 → Provider 映射注册
// ============================================================

import type { ProviderRegistration } from './types'

export class ProviderRegistry {
  private registrations: Map<string, ProviderRegistration> = new Map()

  register(registration: ProviderRegistration): void {
    this.registrations.set(registration.provider, registration)
  }

  unregister(provider: string): void {
    this.registrations.delete(provider)
  }

  getProvider(provider: string): ProviderRegistration | undefined {
    return this.registrations.get(provider)
  }

  getProvidersByCapability(capability: string): ProviderRegistration[] {
    const result: ProviderRegistration[] = []
    for (const reg of this.registrations.values()) {
      if (reg.capabilities.some(c => c.capability === capability) && reg.enabled) {
        result.push(reg)
      }
    }
    // 按 priority 排序（低 = 优先）
    return result.sort((a, b) => {
      const aCap = a.capabilities.find(c => c.capability === capability)!
      const bCap = b.capabilities.find(c => c.capability === capability)!
      return aCap.priority - bCap.priority
    })
  }

  getAllProviders(): ProviderRegistration[] {
    return Array.from(this.registrations.values())
  }

  clear(): void {
    this.registrations.clear()
  }
}
