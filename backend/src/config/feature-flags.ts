// ============================================================
// Feature Flags — KMKI Platform (Phase 1.0)
// ============================================================
// 统一 Feature Flag 体系，供后端、前端、Repository、API 共享
// 不写死 GEO 专属 flag，预留扩展给短剧/小说/PPT
// ============================================================

/**
 * Feature Flag 定义
 * - enabled: 是否启用
 * - description: 说明
 * - dependencies: 依赖的其他 flag（可选）
 * - owner: 负责人/团队
 * - phase: 所属阶段
 */
export interface FeatureFlag {
  key: string
  enabled: boolean
  description: string
  dependencies?: string[]
  owner?: string
  phase?: string
}

/**
 * 所有平台 Feature Flag
 */
export const PLATFORM_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  /* ═══════════════════════════════════════════════
     Phase 1.0 — Tenant & Project Center
     ═══════════════════════════════════════════════ */
  PROJECT_V2_ENABLED: {
    key: 'PROJECT_V2_ENABLED',
    enabled: process.env.FEATURE_PROJECT_V2 === 'true',
    description: '统一 Project 主实体（替代 GEOProject/HdzProject 等独立实体）',
    owner: 'platform-team',
    phase: 'phase-1',
  },

  TENANT_ISOLATION_ENABLED: {
    key: 'TENANT_ISOLATION_ENABLED',
    enabled: process.env.FEATURE_TENANT_ISOLATION === 'true',
    description: '多租户数据隔离（所有数据通过 tenantId 过滤）',
    dependencies: ['PROJECT_V2_ENABLED'],
    owner: 'platform-team',
    phase: 'phase-1',
  },

  /* ═══════════════════════════════════════════════
     Future: Phase 2 — Membership & Feature Gate
     ═══════════════════════════════════════════════ */
  FEATURE_GATE_ENABLED: {
    key: 'FEATURE_GATE_ENABLED',
    enabled: process.env.FEATURE_GATE_ENABLED === 'true',
    description: 'Feature Gate 统一权限体系（替代 if(vip) 硬编码）',
    owner: 'platform-team',
    phase: 'phase-2',
  },

  /* ═══════════════════════════════════════════════
     Future: Phase 3 — Resource Platform
     ═══════════════════════════════════════════════ */
  RESOURCE_PLATFORM_ENABLED: {
    key: 'RESOURCE_PLATFORM_ENABLED',
    enabled: process.env.FEATURE_RESOURCE_PLATFORM === 'true',
    description: 'Resource Platform v4.2（统一资源管理）',
    dependencies: ['PROJECT_V2_ENABLED', 'TENANT_ISOLATION_ENABLED'],
    owner: 'platform-team',
    phase: 'phase-3',
  },

  /* ═══════════════════════════════════════════════
     GEO 专用（短期，后续由 FEATURE_GATE_ENABLED 取代）
     ═══════════════════════════════════════════════ */
  GEO_USE_LEGACY_PROJECT: {
    key: 'GEO_USE_LEGACY_PROJECT',
    enabled: process.env.GEO_USE_LEGACY_PROJECT !== 'true', // 默认启用新逻辑
    description: 'GEO 使用旧 GEOProject 表还是新 Project+GeoProfile（true=旧）',
    dependencies: ['PROJECT_V2_ENABLED'],
    owner: 'geo-team',
    phase: 'phase-1',
  },

  /* ═══════════════════════════════════════════════
     Stage 3: Dual Write（Phase 1a）
     ═══════════════════════════════════════════════ */
  DUAL_WRITE_PROJECT: {
    key: 'DUAL_WRITE_PROJECT',
    enabled: process.env.DUAL_WRITE_PROJECT === 'true',
    description: 'Stage 3: 双写 Project 新字段（tenantId/type/ownerId 等）',
    dependencies: ['PROJECT_V2_ENABLED'],
    owner: 'platform-team',
    phase: 'phase-1a',
  },

  DUAL_WRITE_GEO_PROFILE: {
    key: 'DUAL_WRITE_GEO_PROFILE',
    enabled: process.env.DUAL_WRITE_GEO_PROFILE === 'true',
    description: 'Stage 3: 双写 GeoProjectProfile（同步 kmki_geo_projects → kmki_geo_project_profiles）',
    dependencies: ['PROJECT_V2_ENABLED'],
    owner: 'platform-team',
    phase: 'phase-1a',
  },
}

/**
 * 获取 Feature Flag 状态
 */
export function isFeatureEnabled(key: string): boolean {
  const flag = PLATFORM_FEATURE_FLAGS[key]
  if (!flag) {
    console.warn(`[FeatureFlags] Unknown flag: ${key}, defaulting to disabled`)
    return false
  }

  // 运行时 override 优先（用于测试/回滚）
  if (runtimeOverrides.has(key)) {
    return runtimeOverrides.get(key)!
  }

  // 检查依赖（仅在无运行时 override 时检查）
  if (flag.dependencies) {
    for (const dep of flag.dependencies) {
      const depFlag = PLATFORM_FEATURE_FLAGS[dep]
      if (!depFlag || !depFlag.enabled) {
        // 依赖未启用 → 自身也不启用
        return false
      }
    }
  }

  return flag.enabled
}

/**
 * 允许在运行时临时覆盖 Feature Flag（用于测试/回滚）
 */
const runtimeOverrides = new Map<string, boolean>()

export function overrideFeatureFlag(key: string, value: boolean): void {
  runtimeOverrides.set(key, value)
}

export function resetFeatureFlag(key: string): void {
  runtimeOverrides.delete(key)
}

export function hasOverride(key: string): boolean {
  return runtimeOverrides.has(key)
}

export function getEffectiveFlag(key: string): FeatureFlag {
  const flag = PLATFORM_FEATURE_FLAGS[key]
  if (!flag) return { key, enabled: false, description: 'unknown' }
  return {
    ...flag,
    enabled: hasOverride(key) ? runtimeOverrides.get(key)! : isFeatureEnabled(key),
  }
}

/**
 * 获取所有 Flag 的状态快照（用于调试/管理页面）
 */
export function getAllFlags(): Record<string, { enabled: boolean; overridden: boolean; description: string; dependencies?: string[] }> {
  const result: Record<string, any> = {}
  for (const [key, flag] of Object.entries(PLATFORM_FEATURE_FLAGS)) {
    result[key] = {
      enabled: hasOverride(key) ? runtimeOverrides.get(key)! : isFeatureEnabled(key),
      overridden: hasOverride(key),
      description: flag.description,
      dependencies: flag.dependencies,
    }
  }
  return result
}
