/**
 * utils/membership-tier.ts
 *
 * Unified Membership Tier Resolution
 *
 * Membership.tier is the single source of truth.
 * User.memberTier is a legacy compatibility field.
 *
 * Always use getEffectiveTier() to resolve a user's tier,
 * never read user.memberTier directly.
 */

import type { Membership } from '@prisma/client'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type MemberTier = string

export interface TierLookup {
  membership?: Pick<Membership, 'tier'> | null
  memberTier?: string | null
}

/** VIP planCode → 兼容 tier 映射（vip_<level> ↔ user.memberTier） */
const VIP_PLAN_TIER: Record<string, string> = {
  vip_basic: 'basic',
  vip_pro: 'pro',
  vip_vips: 'vips',
  vip_director: 'director',
}

/**
 * Resolve the effective tier for a user.
 *
 * Priority:
 *   1. Membership.tier (SSOT)
 *   2. User.memberTier (legacy fallback)
 *   3. 'free' (default)
 */
export function getEffectiveTier(lookup: TierLookup): MemberTier {
  // 空字符串 '' 与 null/undefined 一样视为 'free'
  const raw = lookup?.membership?.tier || lookup?.memberTier || 'free'
  return raw === '' ? 'free' : raw
}

/**
 * SPRINT-COMMERCE-SSOT-02: Entitlement 优先的异步解析
 *
 * 判定链（掌柜冻结：Entitlement 为权益权威）：
 *   1. PersonalEntitlement(productType=VIP, active, 未过期) → planCode 映射 tier
 *   2. Membership.tier（存量兼容）
 *   3. User.memberTier（legacy 兼容）
 *   4. 'free'
 */
export async function resolveEffectiveTierAsync(userId: string): Promise<MemberTier> {
  try {
    const ent = await prisma.personalEntitlement.findFirst({
      where: { userId, productType: 'VIP', status: 'active' },
      orderBy: { createdAt: 'desc' },
    })
    if (ent) {
      // 校验订阅 + 未过期
      const sub = await prisma.subscription.findUnique({ where: { id: ent.subscriptionId } })
      const notExpired = !ent.effectiveUntil || ent.effectiveUntil > new Date()
      if (sub && sub.status === 'active' && notExpired) {
        const tier = VIP_PLAN_TIER[ent.planCode]
        if (tier) return tier
        // 未知 VIP 商品：从 planCode 剥离 vip_ 前缀兜底
        if (ent.planCode.startsWith('vip_')) return ent.planCode.slice(4)
      }
    }
  } catch (e) {
    console.error('[membership-tier] Entitlement 解析失败，回退存量判定:', (e as Error).message)
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { memberTier: true, membership: { select: { tier: true } } },
  })
  return getEffectiveTier({ membership: dbUser?.membership, memberTier: dbUser?.memberTier })
}

/**
 * Check if a user has an active paid tier (not free).
 */
export function isPaidTier(lookup: TierLookup): boolean {
  return getEffectiveTier(lookup) !== 'free'
}
