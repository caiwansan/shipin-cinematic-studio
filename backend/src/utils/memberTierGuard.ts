/**
 * utils/memberTierGuard.ts — Service 层会员等级断言
 *
 * 当多个入口调用同一个 service 方法时，在方法开头调用此断言，
 * 替代散落的 `if (user.memberTier === 'free')` 判断。
 */

import { MemberTier, toMemberTier } from '../middleware/require-member-tier'

export class ForbiddenError extends Error {
  constructor(
    message = 'Membership tier insufficient',
    public required: string,
    public current: string,
  ) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export function assertMemberTier(
  user: { memberTier?: string | number | null } | null | undefined,
  minTier: MemberTier,
): void {
  if (!user) {
    throw new ForbiddenError('Unauthorized', MemberTier[minTier], 'none')
  }

  const current = toMemberTier(user.memberTier)
  if (current < minTier) {
    throw new ForbiddenError(
      'Membership tier insufficient',
      MemberTier[minTier],
      MemberTier[current],
    )
  }
}
