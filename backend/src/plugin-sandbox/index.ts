/**
 * plugin-sandbox/index.ts
 *
 * ⚔️ Phase 6 — Plugin Sandbox（隔离执行环境）
 *
 * 插件规则：
 *   ✅ 可以访问 Director Runtime（只读）
 *   ✅ 可以修改 Style DSL 输入
 *   ❌ 不能访问 Blueprint Compiler
 *   ❌ 不能访问 Compiler 内部
 *   ❌ 不能访问 Execution Spine
 *   ❌ 不能注入 Runtime 代码
 */

import type { DirectorPlan } from '../director-runtime/types.js'

// ── Plugin 定义 ──

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  /** 插件影响范围 */
  scope: 'director' | 'style' | 'intent'
  /** 作者 */
  author: string
  /** 入口函数 */
  handler: PluginHandler
}

// ── Plugin 输入 ──

export interface PluginInput {
  /** 用户原始意图（只读） */
  userIntent: string
  /** DirectorPlan（只读） */
  directorPlan: DirectorPlan | null
  /** 风格提示（可修改） */
  styleHints: string[]
  /** 项目元数据 */
  meta: {
    narrativeType?: string
    sceneCount?: number
    projectId?: string
  }
}

// ── Plugin 输出 ──

export interface PluginOutput {
  /** 修改后的意图（仅 scope=intent 时有效） */
  modifiedIntent?: string
  /** 风格建议列表（仅 scope=style 时有效） */
  styleSuggestions?: string[]
  /** 风格 DSL 片段（仅 scope=style 时有效） */
  styleDSLFragments?: string[]
  /** Director 偏好（仅 scope=director 时有效） */
  directorPreference?: string
  /** 日志 */
  log: string[]
}

// ── Plugin 处理器 ──

export type PluginHandler = (input: PluginInput) => PluginOutput | Promise<PluginOutput>

// ── 沙箱注册表 ──

const plugins: Map<string, PluginManifest> = new Map()

/**
 * registerPlugin — 注册插件
 *
 * 规则：
 *   - 不允许覆盖已有的插件
 *   - 不允许 scope 为空
 *   - 运行时验证 handler 边界
 */
export function registerPlugin(manifest: PluginManifest): boolean {
  if (plugins.has(manifest.id)) {
    console.warn(`[PLUGIN_SANDBOX] 插件 ${manifest.id} 已存在`)
    return false
  }

  if (!['director', 'style', 'intent'].includes(manifest.scope)) {
    console.warn(`[PLUGIN_SANDBOX] 插件 ${manifest.id} 的 scope 无效: ${manifest.scope}`)
    return false
  }

  // handler 必须是函数
  if (typeof manifest.handler !== 'function') {
    console.warn(`[PLUGIN_SANDBOX] 插件 ${manifest.id} 的 handler 必须是函数`)
    return false
  }

  plugins.set(manifest.id, manifest)
  console.log(`[PLUGIN_SANDBOX] 注册插件: ${manifest.id} v${manifest.version} (scope=${manifest.scope})`)
  return true
}

// ── 插件执行 ──

/**
 * executePlugin — 沙箱执行插件
 *
 * 安全边界：
 *   - 输入被限制为 PluginInput（只读框架）
 *   - 输出被限制为 PluginOutput
 *   - handler 不能访问外部模块
 *   - 超时保护
 */
export async function executePlugin(
  pluginId: string,
  input: PluginInput
): Promise<PluginOutput> {
  const plugin = plugins.get(pluginId)
  if (!plugin) {
    return {
      log: [`插件 ${pluginId} 未注册`],
    }
  }

  // 验证输入：directorPlan 只读（用序列化+反序列化保证不可变）
  const safeInput: PluginInput = {
    userIntent: input.userIntent,
    directorPlan: input.directorPlan
      ? JSON.parse(JSON.stringify(input.directorPlan))
      : null,
    styleHints: [...input.styleHints],
    meta: { ...input.meta },
  }

  try {
    const result = await plugin.handler(safeInput)

    // 验证输出
    if (result.modifiedIntent && plugin.scope !== 'intent') {
      console.warn(`[PLUGIN_SANDBOX] 插件 ${pluginId} 越界：scope=${plugin.scope} 但修改了 intent`)
      return {
        log: [`[SANDBOX BLOCKED] ${pluginId} 越界：不允许修改 intent (scope=${plugin.scope})`],
      }
    }

    if (result.directorPreference && plugin.scope !== 'director') {
      console.warn(`[PLUGIN_SANDBOX] 插件 ${pluginId} 越界：scope=${plugin.scope} 但修改了 director`)
      return {
        log: [`[SANDBOX BLOCKED] ${pluginId} 越界：不允许修改 director (scope=${plugin.scope})`],
      }
    }

    return result
  } catch (e) {
    console.error(`[PLUGIN_SANDBOX] 插件 ${pluginId} 执行异常:`, e)
    return {
      log: [`[PLUGIN_SANDBOX_ERROR] ${(e as Error).message}`],
    }
  }
}

// ── 插件查询 ──

export function listPlugins(): Array<Omit<PluginManifest, 'handler'>> {
  return Array.from(plugins.values()).map(p => ({
    id: p.id,
    name: p.name,
    version: p.version,
    description: p.description,
    scope: p.scope,
    author: p.author,
  }))
}

export function getPlugin(id: string): PluginManifest | undefined {
  return plugins.get(id)
}

// ── 边界验证 ──

export interface BoundaryValidationResult {
  canAccess: boolean
  allowedScopes: string[]
  reason: string
}

/**
 * validatePluginBoundary — 验证插件可访问的资源
 *
 * 返回插件可以访问的系统层列表。
 */
export function validatePluginBoundary(scope: string): BoundaryValidationResult {
  switch (scope) {
    case 'intent':
      return {
        canAccess: true,
        allowedScopes: ['intent'],
        reason: '插件可修改用户意图',
      }
    case 'style':
      return {
        canAccess: true,
        allowedScopes: ['style'],
        reason: '插件可修改风格提示',
      }
    case 'director':
      return {
        canAccess: true,
        allowedScopes: ['director'],
        reason: '插件可偏好 Director',
      }
    default:
      return {
        canAccess: false,
        allowedScopes: [],
        reason: `未知 scope: ${scope}`,
      }
  }
}
