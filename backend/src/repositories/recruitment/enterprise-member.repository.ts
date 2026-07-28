/**
 * enterprise-member.repository.ts — 企业成员关联层
 *
 * Sprint-Enterprise-Identity-Hardening-01 Phase 3:
 * 使用 EnterpriseContextService 作为唯一解析入口。
 *
 * JWT user.id → resolveCurrentEnterprise() → enterpriseId
 */

import { prisma } from '../../utils/index.js'
import { resolveCurrentEnterprise } from '../../services/enterprise-context.service.js'

export interface EnterpriseContext {
  enterpriseId: string
  role: string
  status: string
  source: 'org_member' | 'onboarding' | 'legacy_migration' | 'migrated'
  memberSource: string
}

/**
 * 获取当前用户的企业上下文
 * 使用统一 EnterpriseContextService 解析。
 */
export async function getEnterpriseContext(
  userId: string
): Promise<EnterpriseContext | null> {
  const ctx = await resolveCurrentEnterprise(userId)
  if (!ctx) return null

  return {
    enterpriseId: ctx.enterpriseId,
    role: ctx.role,
    status: ctx.status,
    source: ctx.source,
    memberSource: ctx.memberSource,
  }
}
