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

export type MemberTier = string

export interface TierLookup {
  membership?: Pick<Membership, 'tier'> | null
  memberTier?: string | null
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
 * Check if a user has an active paid tier (not free).
 */
export function isPaidTier(lookup: TierLookup): boolean {
  return getEffectiveTier(lookup) !== 'free'
}
