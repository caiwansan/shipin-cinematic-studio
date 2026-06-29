// ============================================================
// GEO Capability Permission System (P2.1)
// 
// 把 Feature Flag（boolean）升级为 Capability Permission System
//
// 结构：
//   FeatureFlags (boolean, 已有)
//     ↓
//   CapabilityMap (capabilityId → minimumTier)
//     ↓
//   PermissionService (userTier + capabilityId → boolean)
//     ↓
//   UI Access Control (show/hide buttons)
//
// Freeze: docs/freeze/GEO-FRONTEND-FREEZE-MANIFEST.md
// Blueprint: docs/freeze/GEO-PRODUCTIZATION-BLUEPRINT.md
// ============================================================

/**
 * 订阅等级（从低到高）
 */
export type SubscriberTier = 'FREE' | 'VIP_1' | 'VIP_2' | 'ADMIN'

/**
 * Capability 唯一标识
 * 对应 Blueprint P2.0 Capability Tree
 */
export type CapabilityId =
  // Project CRUD
  | 'geo.project.create'
  | 'geo.project.read'
  | 'geo.project.update'
  | 'geo.project.delete'

  // Execution
  | 'geo.execution.discover'
  | 'geo.execution.graph.build'
  | 'geo.execution.kq'
  | 'geo.execution.watch'

  // Graph
  | 'geo.graph.read'
  | 'geo.graph.node.create'
  | 'geo.graph.edge.create'

  // System
  | 'geo.system.hydrate'
  | 'geo.system.watcher'

/**
 * Capability → 最小订阅等级映射
 * 每个 capability 需要至少哪个 tier 才能用
 */
const CAPABILITY_TIER_MAP: Record<CapabilityId, SubscriberTier> = {
  // Project CRUD — 所有用户
  'geo.project.create': 'FREE',
  'geo.project.read': 'FREE',
  'geo.project.update': 'FREE',
  'geo.project.delete': 'VIP_1',

  // Execution — FREE 可用基础，高级功能逐级开放
  'geo.execution.discover': 'FREE',
  'geo.execution.graph.build': 'VIP_1',
  'geo.execution.kq': 'VIP_2',
  'geo.execution.watch': 'FREE',

  // Graph — 可视化需要至少 VIP_1
  'geo.graph.read': 'VIP_1',
  'geo.graph.node.create': 'VIP_1',
  'geo.graph.edge.create': 'VIP_2',

  // System — 基础功能免费
  'geo.system.hydrate': 'FREE',
  'geo.system.watcher': 'FREE',
}

/**
 * Tier 等级数值（越大越高）
 */
const TIER_ORDER: Record<SubscriberTier, number> = {
  FREE: 0,
  VIP_1: 1,
  VIP_2: 2,
  ADMIN: 99,
}

/**
 * PermissionService — 权限查询服务
 *
 * 不依赖 store，纯函数。输入 userTier + capabilityId → boolean。
 */
export const PermissionService = {
  /**
   * 判断用户是否有某个 capability 的权限
   */
  hasCapability(userTier: SubscriberTier, capabilityId: CapabilityId): boolean {
    const requiredTier = CAPABILITY_TIER_MAP[capabilityId]
    if (!requiredTier) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[PermissionService] Unknown capability: ${capabilityId}`)
      }
      return false
    }
    return TIER_ORDER[userTier] >= TIER_ORDER[requiredTier]
  },

  /**
   * 获取某个 capability 所需的最低 tier
   */
  getRequiredTier(capabilityId: CapabilityId): SubscriberTier | null {
    return CAPABILITY_TIER_MAP[capabilityId] ?? null
  },

  /**
   * 获取用户在当前 tier 下可用的所有 capability
   */
  getAvailableCapabilities(userTier: SubscriberTier): CapabilityId[] {
    return (Object.entries(CAPABILITY_TIER_MAP) as [CapabilityId, SubscriberTier][])
      .filter(([_, requiredTier]) => TIER_ORDER[userTier] >= TIER_ORDER[requiredTier])
      .map(([id]) => id)
  },

  /**
   * 获取完整 capability 列表及其 tier 要求（用于调试/管理页面）
   */
  getAllCapabilities(): Array<{ id: CapabilityId; requiredTier: SubscriberTier }> {
    return (Object.entries(CAPABILITY_TIER_MAP) as [CapabilityId, SubscriberTier][]).map(
      ([id, requiredTier]) => ({ id, requiredTier })
    )
  },
}

/**
 * 获取当前用户 tier 的辅助函数（从已有 store 派生）
 * 
 * 当前实现：从 localStorage.token 反推 (since we don't have user store yet)
 * 未来：接入 UserStore.tenant.subscriptionTier
 */
export function getCurrentUserTier(): SubscriberTier {
  try {
    if (import.meta.client) {
      // 1) localStorage override for dev
      const override = localStorage.getItem('geo_tier_override') as SubscriberTier | null
      if (override && ['FREE', 'VIP_1', 'VIP_2', 'ADMIN'].includes(override)) {
        return override as SubscriberTier
      }

      // 2) Read memberTier from auth_user localStorage (set on login)
      const authUserRaw = localStorage.getItem('auth_user')
      if (authUserRaw) {
        const authUser = JSON.parse(authUserRaw)
        const tier = authUser.memberTier || authUser.member_tier
        // Map known DB tiers to SubscriberTier
        const tierMap: Record<string, SubscriberTier> = {
          'enterprise': 'ADMIN',
          'premium': 'VIP_2',
          'pro': 'VIP_1',
          'FREE': 'FREE',
          'VIP_1': 'VIP_1',
          'VIP_2': 'VIP_2',
          'ADMIN': 'ADMIN',
        }
        if (tier && tierMap[tier]) {
          return tierMap[tier]
        }
      }
    }
    
    return 'FREE'
  } catch {
    return 'FREE'
  }
}
