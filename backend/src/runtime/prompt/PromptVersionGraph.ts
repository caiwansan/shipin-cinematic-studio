/**
 * PromptVersionGraph.ts — Phase 4-A 最小版本图系统
 *
 * 职责：
 * 1. 维护每个 prompt 的版本链 (v1, v2, v3...)
 * 2. 标记每个版本的 label: stable | canary | deprecated | override
 * 3. 只读运行时查询：不支持自演化、自动版本生成
 *
 * @phase-4a
 */

import { prisma } from '../../utils/index.js'
import { runAsRegistry } from './PromptAccessGuard.js'

// ─── 类型定义 ───

export type PromptVariantLabel = 'stable' | 'canary' | 'deprecated' | 'override'

export interface PromptVersionNode {
  id: string
  name: string
  version: string       // "v1", "v2"...
  label: PromptVariantLabel
  description?: string
  parentVersion?: string  // 上一版本的 version string
  content?: any
  createdAt: Date
}

// ─── 缓存（TTL 30 秒，够观测期用） ───

const VERSION_CACHE_TTL = 30_000 // 30s
const _versionCache = new Map<string, { nodes: PromptVersionNode[]; timestamp: number }>()

function cacheKey(name: string): string {
  return `version:${name}`
}

// ─── 核心 API ───

/**
 * 获取某个 prompt 在当前观测期的 stable 版本号
 * 如果没有 stable 标记，返回最新版本
 */
export async function getStableVersion(name: string): Promise<string> {
  const all = await getAllVersions(name)
  const stable = all.find(n => n.label === 'stable')
  if (stable) return stable.version
  // 无 stable 标记→返回最新版
  return all.length > 0 ? all[all.length - 1].version : 'v1'
}

/**
 * 获取当前选中的版本（默认 stable）
 */
export async function getCurrentVersion(name: string): Promise<string> {
  return getStableVersion(name)
}

/**
 * 获取 prompt 的所有版本节点（按 createdAt 升序）
 */
export async function getAllVersions(name: string): Promise<PromptVersionNode[]> {
  const key = cacheKey(name)
  const cached = _versionCache.get(key)
  if (cached && Date.now() - cached.timestamp < VERSION_CACHE_TTL) {
    return cached.nodes
  }

  const rows = await runAsRegistry(() =>
    prisma.promptVariant.findMany({
      where: { name },
      orderBy: { createdAt: 'asc' },
    })
  )

  const nodes: PromptVersionNode[] = rows.map(r => ({
    id: r.id,
    name: r.name,
    version: r.version,
    label: r.label as PromptVariantLabel,
    description: r.description || undefined,
    parentVersion: r.parentVersion || undefined,
    content: r.content,
    createdAt: r.createdAt,
  }))

  _versionCache.set(key, { nodes, timestamp: Date.now() })
  return nodes
}

/**
 * 获取特定版本的节点
 */
export async function getVersion(name: string, version: string): Promise<PromptVersionNode | null> {
  const all = await getAllVersions(name)
  return all.find(n => n.version === version) || null
}

/**
 * 注册一个新版本节点
 * 不自动切换 label 或 promote
 */
export async function registerVersion(node: {
  name: string
  version: string
  label?: PromptVariantLabel
  description?: string
  parentVersion?: string
  content?: any
}): Promise<void> {
  await runAsRegistry(() =>
    prisma.promptVariant.create({
      data: {
        name: node.name,
        version: node.version,
        label: node.label || 'canary',
        description: node.description,
        content: node.content || {},
        parentVersion: node.parentVersion,
      },
    })
  )
  // 清楚缓存
  _versionCache.delete(cacheKey(node.name))
}

/**
 * 手工切换版本的 label（仅允许 stable / deprecated / override）
 * 不自动 promote，手动确认
 */
export async function setVersionLabel(
  name: string,
  version: string,
  label: Exclude<PromptVariantLabel, 'canary'>
): Promise<void> {
  await runAsRegistry(() =>
    prisma.promptVariant.updateMany({
      where: { name, version },
      data: { label },
    })
  )
  _versionCache.delete(cacheKey(name))
}

/**
 * 清除版本缓存（用于热更新）
 */
export function invalidateVersionCache(name?: string): void {
  if (name) {
    _versionCache.delete(cacheKey(name))
  } else {
    _versionCache.clear()
  }
}
