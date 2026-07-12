/**
 * provider-registry.ts — Provider 注册表
 *
 * SSOT: 所有支持的 Provider 配置集中在此注册。
 * 外部通过 ProviderRegistry.get() 获取 ProviderProfile，不得硬编码 provider 配置。
 */

import { ProviderProfile } from './provider-profile.types.js'

const registry = new Map<string, ProviderProfile>()

/**
 * 注册 Provider Profile
 */
export function register(profile: ProviderProfile): void {
  const key = profile.name.toLowerCase().trim()
  registry.set(key, profile)
}

/**
 * 批量注册 Provider Profiles
 */
export function registerAll(profiles: ProviderProfile[]): void {
  for (const p of profiles) {
    register(p)
  }
}

/**
 * 获取 Provider Profile（不抛异常）
 */
export function get(name: string): ProviderProfile | undefined {
  if (!name) return undefined
  return registry.get(name.toLowerCase().trim())
}

/**
 * 获取所有已注册的 Provider
 */
export function getAll(): ProviderProfile[] {
  return Array.from(registry.values())
}

/**
 * 获取所有已注册的 Provider 名称列表
 */
export function getAllNames(): string[] {
  return Array.from(registry.keys())
}

/**
 * 检查 Provider 是否已注册
 */
export function has(name: string): boolean {
  return registry.has(name.toLowerCase().trim())
}

/**
 * 重置注册表（主要用于测试）
 */
export function reset(): void {
  registry.clear()
}

/**
 * 命名空间对象 — 方便统一导入
 */
export const ProviderRegistry = {
  register,
  registerAll,
  get,
  getAll,
  getAllNames,
  has,
  reset,
}
