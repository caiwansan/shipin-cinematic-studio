// ============================================================
// Frontend Feature Flags
// Phase 1.0 — KMKI-PLAT-FLAGS-FE
// ============================================================

export type FeatureFlagKey =
  | 'project-v2-enabled'
  | 'tenant-isolation-enabled'
  | 'feature-gate-enabled'
  | 'resource-platform-enabled'
  | 'geo-use-legacy-project'

export interface FeatureFlagState {
  key: FeatureFlagKey
  enabled: boolean
  description: string
}

/**
 * 前端 Feature Flag
 *
 * 默认值：
 * - 生产环境从 `runtimeConfig.public.featureFlags` 读取
 * - 开发环境可通过 localStorage 覆盖
 */
const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = {
  'project-v2-enabled': false,
  'tenant-isolation-enabled': false,
  'feature-gate-enabled': false,
  'resource-platform-enabled': false,
  'geo-use-legacy-project': true, // 默认走旧逻辑，直到完全切换
}

/**
 * 从运行时配置获取 Feature Flag
 */
function getFlagFromConfig(key: FeatureFlagKey): boolean {
  try {
    const config = useRuntimeConfig()
    const flags = (config.public as any)?.featureFlags
    if (flags && typeof flags[key] === 'boolean') {
      return flags[key]
    }
  } catch {
    // SSR 环境可能没有 useRuntimeConfig
  }
  return DEFAULT_FEATURE_FLAGS[key]
}

/**
 * 从 localStorage 获取覆盖
 */
function getFlagFromStorage(key: FeatureFlagKey): boolean | null {
  if (import.meta.client) {
    try {
      const val = localStorage.getItem(`feature_flag_${key}`)
      if (val === 'true') return true
      if (val === 'false') return false
    } catch {
      // Safari private mode
    }
  }
  return null
}

/**
 * 检查 Feature Flag 是否启用
 *
 * 优先级：localStorage > runtimeConfig > default
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  const overridden = getFlagFromStorage(key)
  if (overridden !== null) return overridden
  return getFlagFromConfig(key)
}

/**
 * 在 localStorage 中临时覆盖 Feature Flag（用于测试）
 */
export function setFeatureFlagOverride(key: FeatureFlagKey, value: boolean): void {
  if (import.meta.client) {
    localStorage.setItem(`feature_flag_${key}`, String(value))
  }
}

/**
 * 清除 localStorage 覆盖
 */
export function clearFeatureFlagOverride(key: FeatureFlagKey): void {
  if (import.meta.client) {
    localStorage.removeItem(`feature_flag_${key}`)
  }
}

/**
 * 获取所有 Feature Flag 状态
 */
export function getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const result = {} as Record<FeatureFlagKey, boolean>
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagKey[]) {
    result[key] = isFeatureEnabled(key)
  }
  return result
}
