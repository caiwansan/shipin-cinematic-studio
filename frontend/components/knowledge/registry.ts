// ════════════════════════════════════════════════════════════
// Component Registry — 公开知识页面渲染器的组件注册表
// 不是 if/else 分支，而是 register + resolve 模式
// 服务端 + 客户端通用（shallowRef 保证响应式但不深度追踪）
// ════════════════════════════════════════════════════════════

import { shallowRef } from 'vue'

interface RegistryEntry {
  name: string
  component: any  // Vue 组件
  description?: string
  aiContext?: boolean  // 是否提供 AI 上下文
}

// 使用 shallowRef 保证响应式但不深度追踪
const registry = shallowRef<Record<string, RegistryEntry>>({})

export function registerComponent(name: string, component: any, description?: string): void {
  registry.value[name] = { name, component, description }
}

export function resolveComponent(name: string): any {
  return registry.value[name]?.component
}

export function getRegisteredComponents(): string[] {
  return Object.keys(registry.value)
}

export function hasComponent(name: string): boolean {
  return name in registry.value
}
