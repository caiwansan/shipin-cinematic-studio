/**
 * enterprise-member.repository.ts — 企业成员关联层
 *
 * CTO Directive: Enterprise Identity Binding
 * JWT user.id → getEnterpriseContext() → enterpriseId
 * 唯一正确的企业上下文获取方式
 *
 * Sprint-03D: 双模型桥接
 *   优先检查 OrgMember (新体系: User → OrgMember → Organization)
 *   回退检查 EnterpriseMember (旧体系: User → EnterpriseMember → JobCompanyProfile)
 */

import { prisma } from '../../utils/index.js'

export interface EnterpriseContext {
  enterpriseId: string
  role: string
  status: string
  source: 'new' | 'old'  // 标识来源
}

/**
 * 获取当前用户的企业上下文
 * Sprint-03D: 优先新模型 (OrgMember)，回退旧模型 (EnterpriseMember)
 * 无企业成员关系的用户 → 返回 null
 */
export async function getEnterpriseContext(
  userId: string
): Promise<EnterpriseContext | null> {
  // ─── 优先: 新体系 OrgMember → Organization → EnterpriseProfile ───
  const orgMembership = await prisma.orgMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      organization: {
        include: { profile: true },
      },
    },
  })

  if (orgMembership?.organization) {
    return {
      enterpriseId: orgMembership.organizationId,
      role: orgMembership.role,
      status: 'ACTIVE',
      source: 'new',
    }
  }

  // ─── 回退: 旧体系 EnterpriseMember → JobCompanyProfile (取最新) ───
  const membership = await prisma.enterpriseMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }, // 取最新的企业
    select: {
      enterpriseId: true,
      role: true,
      status: true,
    },
  })

  if (membership) {
    return {
      enterpriseId: membership.enterpriseId,
      role: membership.role,
      status: membership.status,
      source: 'old',
    }
  }

  // ─── 回退: onboarding 创建的 Organization ───
  const onboardOrg = await prisma.organization.findFirst({
    where: { ownerId: userId, slug: { startsWith: 'onboard-' } },
    orderBy: { createdAt: 'desc' },
  })
  if (onboardOrg) {
    return {
      enterpriseId: onboardOrg.id,
      role: 'owner',
      status: 'ACTIVE',
      source: 'new',
    }
  }

  return null
}
