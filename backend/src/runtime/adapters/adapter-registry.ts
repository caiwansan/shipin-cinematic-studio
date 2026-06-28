/**
 * adapters/adapter-registry.ts — Phase W.1 Adapter Registry
 *
 * 统一的工作台 Adapter 注册中心。
 * 所有 RuntimeAdapter 实现都在此注册，形成单一发现入口。
 *
 * 宪法级规则（不可违反）：
 *   1. Adapter 注册后禁止重复注册
 *   2. 每个工作台类型只允许一个 adapter
 *   3. Adapter 不包含任何业务逻辑，只做序列化映射
 */

import type { RuntimeAdapter } from '../persistence/contract.js'

const registry = new Map<string, RuntimeAdapter>()

/**
 * 注册工作台适配器
 * @param type 工作台类型（ppt | storyboard | novel）
 * @param adapter RuntimeAdapter 实现
 * @throws 如果 type 已注册
 */
export function registerAdapter(type: string, adapter: RuntimeAdapter): void {
  if (registry.has(type)) {
    throw new Error(
      `[AdapterRegistry] 工作台类型 "${type}" 已注册 adapter，禁止重复注册`
    )
  }
  registry.set(type, adapter)
  console.log(`[AdapterRegistry] 已注册 adapter: ${type}`)
}

/**
 * 获取工作台适配器
 * @param type 工作台类型
 * @returns RuntimeAdapter | undefined
 */
export function getAdapter(type: string): RuntimeAdapter | undefined {
  return registry.get(type)
}

/**
 * 检查工作台类型是否已注册 adapter
 */
export function hasAdapter(type: string): boolean {
  return registry.has(type)
}

/**
 * 列出所有已注册的工作台类型
 */
export function listAdapters(): string[] {
  return Array.from(registry.keys())
}

export default { registerAdapter, getAdapter, hasAdapter, listAdapters }
