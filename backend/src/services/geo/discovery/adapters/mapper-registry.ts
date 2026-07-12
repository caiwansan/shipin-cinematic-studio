// ============================================================
// SignalMapperRegistry — 所有 SignalMapper 的注册中心
//
// Pipeline 通过 Registry 获取 Mapper，不直接引用 Provider
// 新增 Provider 只需：Mapper 实现 + Registry 注册
// ============================================================

import type { SignalMapper } from './signal-mapper.js'
import { DeepSeekSignalMapper } from './deepseek-mapper.js'
import { ChatGPTMapper } from './chatgpt-mapper.js'

const registry = new Map<string, SignalMapper>()

/** 注册一个 SignalMapper */
export function registerMapper(mapper: SignalMapper): void {
  registry.set(mapper.provider.toLowerCase(), mapper)
}

/** 根据 Provider 名称获取对应的 Mapper */
export function getMapper(provider: string): SignalMapper | undefined {
  return registry.get(provider.toLowerCase())
}

/** 检查是否有 Mapper 支持该 Provider */
export function hasMapper(provider: string): boolean {
  return registry.has(provider.toLowerCase())
}

/** 获取所有已注册的 Mapper */
export function getMappers(): SignalMapper[] {
  return Array.from(registry.values())
}

/** 初始化默认 Mapper */
export function initDefaultMappers(): void {
  registerMapper(new DeepSeekSignalMapper())
  registerMapper(new ChatGPTMapper())
}

// 自动注册默认 Mapper
initDefaultMappers()
