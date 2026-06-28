/**
 * director-marketplace/index.ts
 *
 * ⚔️ Phase 6 — Director Marketplace（只读市场）
 *
 * 规则：
 *   - metadata only
 *   - 无可执行逻辑
 *   - 版本化描述符
 *   - 所有 Director 必须经过 Orchestrator 验证
 */

import type { DirectorProfile } from '../director-registry/index.js'

// ── 市场条目 ──

export interface MarketplaceEntry {
  /** Director ID */
  id: string
  /** 名称 */
  name: string
  /** 版本 */
  version: string
  /** 描述 */
  description: string
  /** 支持的叙事类型 */
  supportedNarrativeTypes: string[]
  /** 支持的风格 */
  supportedStyles: string[]
  /** 作者 */
  author: string
  /** 标签 */
  tags: string[]
  /** 评级（1-5） */
  rating: number
  /** 安装数 */
  installCount: number
  /** 是否内置 */
  builtIn: boolean
  /** 注册时间 */
  listedAt: number
}

// ── 市场存储 ──

const marketplace: Map<string, MarketplaceEntry> = new Map()

// ── 内置条目 ──

const BUILT_IN_ENTRIES: MarketplaceEntry[] = [
  {
    id: 'canon',
    name: '经典叙事导演',
    version: '1.0.0',
    description: '6 模板 + 关键词匹配，确定性叙事规划。适合通用叙事场景。',
    supportedNarrativeTypes: ['灾难', '爱情', '悬疑', '古装', '科幻', '冒险', '默认'],
    supportedStyles: ['noir', 'cinematic', 'anime', 'minimalist', 'vintage', 'tech'],
    author: '昆仑镜系统',
    tags: ['通用', '经典', '内置'],
    rating: 4.5,
    installCount: 1280,
    builtIn: true,
    listedAt: Date.now(),
  },
]

for (const entry of BUILT_IN_ENTRIES) {
  marketplace.set(entry.id, entry)
}

// ── 上架（仅 metadata） ──

export interface ListEntryParams {
  id: string
  name: string
  version: string
  description: string
  supportedNarrativeTypes: string[]
  supportedStyles: string[]
  author: string
  tags?: string[]
}

/**
 * listDirector — 上架 Director（metadata only）
 *
 * 规则：
 *   - 不验证逻辑（不在市场上执行代码）
 *   - 只记录描述信息
 *   - 不允许覆写内置 Director
 */
export function listDirector(params: ListEntryParams): boolean {
  if (marketplace.has(params.id)) {
    const existing = marketplace.get(params.id)!
    if (existing.builtIn) {
      console.warn(`[MARKETPLACE] 不允许覆盖内置 Director: ${params.id}`)
      return false
    }
  }

  marketplace.set(params.id, {
    ...params,
    tags: params.tags ?? [],
    rating: 0,
    installCount: 0,
    builtIn: false,
    listedAt: Date.now(),
  })

  console.log(`[MARKETPLACE] 上架 Director: ${params.id} v${params.version}`)
  return true
}

// ── 查询 ──

export function getMarketplaceEntry(id: string): MarketplaceEntry | undefined {
  return marketplace.get(id)
}

export function listMarketplace(
  filter?: {
    narrativeType?: string
    style?: string
    tag?: string
    builtInOnly?: boolean
  }
): MarketplaceEntry[] {
  let results = Array.from(marketplace.values())

  if (filter) {
    if (filter.narrativeType) {
      results = results.filter(e =>
        e.supportedNarrativeTypes.some(t => t.includes(filter!.narrativeType!) || filter!.narrativeType!.includes(t))
      )
    }
    if (filter.style) {
      results = results.filter(e =>
        e.supportedStyles.includes(filter!.style!)
      )
    }
    if (filter.tag) {
      results = results.filter(e => e.tags.includes(filter!.tag!))
    }
    if (filter.builtInOnly) {
      results = results.filter(e => e.builtIn)
    }
  }

  return results.sort((a, b) => b.rating - a.rating)
}

/**
 * searchMarketplace — 搜索市场
 *
 * 按关键词搜索名称、描述、标签。
 */
export function searchMarketplace(keyword: string): MarketplaceEntry[] {
  const kw = keyword.toLowerCase()
  return Array.from(marketplace.values()).filter(e =>
    e.name.toLowerCase().includes(kw) ||
    e.description.toLowerCase().includes(kw) ||
    e.tags.some(t => t.toLowerCase().includes(kw)) ||
    e.supportedNarrativeTypes.some(t => t.toLowerCase().includes(kw))
  ).sort((a, b) => b.rating - a.rating)
}

/**
 * getDirectorProfile — 从市场条目生成 DirectorProfile
 *
 * 这是通往执行层的唯一路径：市场条目 → DirectorProfile（入 Director Registry）。
 */
export function marketEntryToProfile(entry: MarketplaceEntry): DirectorProfile {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    supportedNarrativeTypes: entry.supportedNarrativeTypes,
    supportedStyles: entry.supportedStyles,
    description: entry.description,
    registeredAt: entry.listedAt,
  }
}
