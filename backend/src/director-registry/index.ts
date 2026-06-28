/**
 * director-registry/index.ts
 *
 * ⚔️ Phase 5 — Director Registry（非 Marketplace）
 *
 * 注意：这不是 Marketplace。
 * 只允许注册配置元数据，不允许代码级扩展。
 *
 * 规则：
 *   - metadata only
 *   - no runtime logic
 *   - no execution behavior
 *   - 只读（注册后不可修改）
 */

import type { DirectorPlan } from '../director-runtime/types.js'

// ── Director Profile ──

export interface DirectorProfile {
  /** 唯一标识 */
  id: string
  /** 可读名称 */
  name: string
  /** 版本 */
  version: string
  /** 支持的叙事类型 */
  supportedNarrativeTypes: string[]
  /** 支持的风格类型 */
  supportedStyles: string[]
  /** 注册时间 */
  registeredAt: number
  /** 描述 */
  description: string
}

// ── 内置 Director ──

const BUILT_IN_DIRECTORS: Record<string, DirectorProfile> = {
  canon: {
    id: 'canon',
    name: '经典叙事导演',
    version: '1.0.0',
    supportedNarrativeTypes: ['灾难', '爱情', '悬疑', '古装', '科幻', '冒险', '默认'],
    supportedStyles: ['noir', 'cinematic', 'anime', 'minimalist', 'vintage', 'tech'],
    registeredAt: Date.now(),
    description: '6 模板 + 关键词匹配，确定性叙事规划',
  },
}

// ── 注册表 ──

const registry: Map<string, DirectorProfile> = new Map()

// 初始化内置 Director
for (const [id, profile] of Object.entries(BUILT_IN_DIRECTORS)) {
  registry.set(id, profile)
}

// ── 注册（仅 metadata） ──

/**
 * registerDirector — 注册 Director Profile
 *
 * 规则：
 *   - 只接受 metadata
 *   - 不允许代码级插件
 *   - 不允许覆盖内置 Director
 */
export function registerDirector(profile: DirectorProfile): boolean {
  if (registry.has(profile.id)) {
    const existing = registry.get(profile.id)!
    if (existing.version === profile.version) {
      console.warn(`[DIRECTOR_REGISTRY] Director ${profile.id} 已存在且版本相同，跳过`)
      return false
    }
    // 不允许覆写内置 Director
    if (BUILT_IN_DIRECTORS[profile.id]) {
      console.warn(`[DIRECTOR_REGISTRY] 不允许覆写内置 Director: ${profile.id}`)
      return false
    }
  }

  registry.set(profile.id, {
    ...profile,
    registeredAt: Date.now(),
  })
  console.log(`[DIRECTOR_REGISTRY] 注册成功: ${profile.id} v${profile.version}`)
  return true
}

// ── 查询 ──

export function getDirectorProfile(id: string): DirectorProfile | undefined {
  return registry.get(id)
}

export function listDirectors(): DirectorProfile[] {
  return Array.from(registry.values())
}

export function matchDirector(narrativeType: string): DirectorProfile | undefined {
  // 精确匹配
  for (const profile of registry.values()) {
    if (profile.supportedNarrativeTypes.includes(narrativeType)) {
      return profile
    }
  }
  // fallback 到 canon
  return registry.get('canon')
}
