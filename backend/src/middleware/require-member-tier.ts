/**
 * 统一会员等级权限中间件
 * 禁止路由内散落 memberTier 判断，所有 VIP 检查必须走 requireMemberTier
 */

export enum MemberTier {
  Free = 0,
  Basic = 1,
  Pro = 2,
  Enterprise = 3,
}

// 字符串到数字的映射（兼容历史数据）
const TIER_MAP: Record<string, MemberTier> = {
  'free': MemberTier.Free,
  'basic': MemberTier.Basic,
  'pro': MemberTier.Pro,
  'enterprise': MemberTier.Enterprise,
  'gold': MemberTier.Pro,        // gold → Pro
  'premium': MemberTier.Pro,     // premium → Pro
  'vip': MemberTier.Pro,         // vip → Pro
  'vip_season': MemberTier.Pro,  // vip_season → Pro
  'vip_year': MemberTier.Pro,    // vip_year → Pro
  'director': MemberTier.Pro,    // director → Pro
}

export function toMemberTier(tier: string | number | undefined | null): MemberTier {
  if (tier === undefined || tier === null) return MemberTier.Free
  if (typeof tier === 'number') return tier >= 0 && tier <= 3 ? tier as MemberTier : MemberTier.Free
  const lower = tier.toLowerCase()
  return TIER_MAP[lower] ?? MemberTier.Free
}

export function hasMinTier(userTier: string | number | undefined | null, minTier: MemberTier): boolean {
  return toMemberTier(userTier) >= minTier
}

// 兼容 Fastify 的中间件形式
export function createRequireMemberTier(minTier: MemberTier) {
  return async (request: any, reply: any) => {
    const user = request.user
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userTier = toMemberTier(user.memberTier)
    if (userTier < minTier) {
      return reply.status(403).send({
        error: 'Membership tier insufficient',
        required: MemberTier[minTier],
        current: MemberTier[userTier],
        upgradeUrl: '/user/membership',
      })
    }
  }
}

// 兼容 express/koa 风格的中间件
export function requireMemberTier(minTier: MemberTier) {
  return createRequireMemberTier(minTier)
}

// 根据策略 key 创建中间件（从 routeTierPolicy 读取配置）
export function requireMemberTierByPolicy(policyKey: string) {
  return async (request: any, reply: any) => {
    const { routeTierPolicy } = await import('../config/routeTierPolicy.js')
    const policy = routeTierPolicy[policyKey]

    if (!policy) {
      return reply.status(500).send({
        error: `Missing route tier policy: ${policyKey}`
      })
    }

    const user = request.user
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const userTier = toMemberTier(user.memberTier)
    if (policy.enforce && userTier < policy.tier) {
      return reply.status(403).send({
        error: 'Membership tier insufficient',
        requiredTier: MemberTier[policy.tier],
        current: MemberTier[userTier],
        routePolicy: policyKey,
        pendingConfirmation: policy.pendingConfirmation ?? false,
        upgradeUrl: '/user/membership',
      })
    }
  }
}
