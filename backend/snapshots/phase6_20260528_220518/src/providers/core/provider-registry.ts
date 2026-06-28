/**
 * P1 — Provider Registry（Runtime Provider Kernel）
 *
 * ═══ 宪法 ═══
 * Registry 是 Runtime 中 provider → adapter 映射的唯一来源。
 * 所有 AI 调用必须通过 Registry 获取 Adapter。
 * 禁止在业务层直接 import 某个 provider 的 SDK。
 */

import { Capability } from '../../core/runtime/capabilities.js'
import { ProviderAdapter } from '../core/provider-adapter.js'

export interface ProviderRegistration {
  name: string
  capabilities: Capability[]
  adapter: ProviderAdapter
}

class ProviderRegistry {
  private registrations: Map<string, ProviderRegistration> = new Map()
  private capabilityIndex: Map<Capability, ProviderRegistration[]> = new Map()

  /**
   * 注册一个 Provider Adapter
   */
  register(registration: ProviderRegistration): void {
    const name = registration.name
    if (this.registrations.has(name)) {
      console.warn(`[ProviderRegistry] ⚠️ Provider "${name}" 重复注册，将覆盖`)
    }
    this.registrations.set(name, registration)

    // 更新 capability 索引
    for (const cap of registration.capabilities) {
      const existing = this.capabilityIndex.get(cap) || []
      // 去重
      if (!existing.find(r => r.name === name)) {
        existing.push(registration)
      }
      this.capabilityIndex.set(cap, existing)
    }

    console.log(`[ProviderRegistry] ✅ 注册 provider="${name}" capabilities=[${registration.capabilities.join(', ')}]`)
  }

  /**
   * 根据 provider 名获取 Adapter
   */
  getAdapter(providerName: string): ProviderAdapter | undefined {
    return this.registrations.get(providerName)?.adapter
  }

  /**
   * 获取支持某个 Capability 的所有 Provider
   */
  getProvidersForCapability(capability: Capability): ProviderRegistration[] {
    return this.capabilityIndex.get(capability) || []
  }

  /**
   * 列出所有已注册的 Provider
   */
  listProviders(): string[] {
    return Array.from(this.registrations.keys())
  }

  /**
   * 清空注册（用于测试或热重载）
   */
  clear(): void {
    this.registrations.clear()
    this.capabilityIndex.clear()
  }
}

export const providerRegistry = new ProviderRegistry()
