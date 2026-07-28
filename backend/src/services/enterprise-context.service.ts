/**
 * enterprise-context.service.ts — 企业身份上下文统一解析服务
 *
 * Sprint-Enterprise-Identity-Hardening-01 Phase 3
 * Sprint-SSOT-CLEANUP-02: EnterpriseMember → OrgMember
 * 唯一合法获取当前用户企业上下文的入口。
 * 所有模块必须通过此服务获取企业身份，禁止自行解析。
 *
 * Observation Sprint Step 1-A:
 * - 增加 memberSource API 输出字段
 * - legacy fallback 降级为 migration-only (legacy_migration)
 * - 增加来源命中日志统计
 *
 * 解析顺序冻结：
 *   1. OrgMember (SSOT)
 *   2. OrgMember (secondary — 兜底)
 *   3. Onboard Organization (onboarding 创建)
 *   4. Legacy (organizationId = userId, migration-only)
 *   5. Migration (govUser → Organization)
 */

import { prisma } from '../utils/index.js'

// ─── memberSource 映射表 ───
const SOURCE_TO_MEMBER_SOURCE: Record<string, string> = {
  org_member: 'OrgMember',
  onboarding: 'Onboarding',
  legacy_migration: 'LegacyMigration',
  migrated: 'LegacyMigration',
}

function resolveMemberSource(source: string): string {
  return SOURCE_TO_MEMBER_SOURCE[source] || 'LegacyMigration'
}

export interface EnterpriseContextResult {
  enterpriseId: string
  role: string
  status: string
  source: 'enterprise_member' | 'org_member' | 'onboarding' | 'legacy_migration' | 'migrated'
  /** API 可见的身份来源标记，用于 Reality Gate 验证 */
  memberSource: string
  enterpriseProfile: {
    id: string
    organizationId: string
    industry: string | null
    businessSummary: string | null
    onboardingStep: number
    onboardingDone: boolean
  } | null
  jobCompanyProfile: {
    id: string
    enterpriseId: string
  } | null
  workspace: {
    id: string
    name: string
    plan: string
    status: string
  } | null
}

/**
 * 解析当前用户的企业上下文 — 唯一入口
 * @param userId - JWT 中的用户 ID
 * @returns EnterpriseContextResult | null
 */
export async function resolveCurrentEnterprise(userId: string): Promise<EnterpriseContextResult | null> {
  if (!userId) return null

  // ─── 1. 首选: OrgMember (SSOT — Sprint-SSOT-CLEANUP-01) ───
  const orgMembership = await prisma.orgMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { organization: true },
  })
  if (orgMembership?.organization) {
    const ep = await prisma.enterpriseProfile.findFirst({
      where: { organizationId: orgMembership.organizationId },
    })
    const jcp = ep ? await prisma.jobCompanyProfile.findUnique({
      where: { enterpriseId: ep.id },
    }) : null
    const workspace = jcp ? await prisma.enterpriseJobWorkspace.findFirst({
      where: { enterpriseId: jcp.id },
    }) : null
    console.log('[EnterpriseContext] resolve source: org_member — userId:', userId)
    return {
      enterpriseId: orgMembership.organizationId,
      role: orgMembership.role,
      status: 'ACTIVE',
      source: 'org_member',
      memberSource: resolveMemberSource('org_member'),
      enterpriseProfile: ep ? {
        id: ep.id,
        organizationId: ep.organizationId,
        industry: ep.industry,
        businessSummary: ep.businessSummary,
        onboardingStep: ep.onboardingStep,
        onboardingDone: ep.onboardingDone,
      } : null,
      jobCompanyProfile: jcp ? { id: jcp.id, enterpriseId: jcp.enterpriseId } : null,
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        status: workspace.status,
      } : null,
    }
  }

  // ─── 2. Secondary: OrgMember (same path, catches migration edge cases) ───
  const secondaryMember = await prisma.orgMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  if (secondaryMember) {
    const ep = await prisma.enterpriseProfile.findFirst({
      where: { organizationId: secondaryMember.organizationId },
    })
    const jcp = ep ? await prisma.jobCompanyProfile.findUnique({
      where: { enterpriseId: ep.id },
    }) : null
    const workspace = jcp ? await prisma.enterpriseJobWorkspace.findFirst({
      where: { enterpriseId: jcp.id },
    }) : null
    console.log('[EnterpriseContext] resolve source: org_member (secondary) — userId:', userId)
    return {
      enterpriseId: secondaryMember.organizationId,
      role: secondaryMember.role,
      status: 'ACTIVE',
      source: 'org_member',
      memberSource: resolveMemberSource('org_member'),
      enterpriseProfile: ep ? {
        id: ep.id,
        organizationId: ep.organizationId,
        industry: ep.industry,
        businessSummary: ep.businessSummary,
        onboardingStep: ep.onboardingStep,
        onboardingDone: ep.onboardingDone,
      } : null,
      jobCompanyProfile: jcp ? { id: jcp.id, enterpriseId: jcp.enterpriseId } : null,
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        status: workspace.status,
      } : null,
    }
  }

  // ─── 3. Onboard Organization (onboarding 创建的) ───
  const onboardOrg = await prisma.organization.findFirst({
    where: { ownerId: userId, slug: { startsWith: 'onboard-' } },
    orderBy: { createdAt: 'desc' },
  })
  if (onboardOrg) {
    const ep = await prisma.enterpriseProfile.findFirst({
      where: { organizationId: onboardOrg.id },
    })
    const jcp = ep ? await prisma.jobCompanyProfile.findUnique({
      where: { enterpriseId: ep.id },
    }) : null
    const workspace = jcp ? await prisma.enterpriseJobWorkspace.findFirst({
      where: { enterpriseId: jcp.id },
    }) : null
    console.log('[EnterpriseContext] resolve source: onboarding — userId:', userId)
    return {
      enterpriseId: onboardOrg.id,
      role: 'owner',
      status: 'ACTIVE',
      source: 'onboarding',
      memberSource: resolveMemberSource('onboarding'),
      enterpriseProfile: ep ? {
        id: ep.id,
        organizationId: ep.organizationId,
        industry: ep.industry,
        businessSummary: ep.businessSummary,
        onboardingStep: ep.onboardingStep,
        onboardingDone: ep.onboardingDone,
      } : null,
      jobCompanyProfile: jcp ? { id: jcp.id, enterpriseId: jcp.enterpriseId } : null,
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        status: workspace.status,
      } : null,
    }
  }

  // ─── 4. Legacy (organizationId = userId, migration-only) ───
  // Observation Sprint Step 1-A: 降级为 migration-only fallback
  // 不再作为正常业务身份来源，仅用于老用户迁移兼容
  console.warn('[EnterpriseContext] ⚠️ resolve using legacy migration path — userId:', userId, '— 请尽快迁移到 OrgMember')
  const legacyEp = await prisma.enterpriseProfile.findFirst({
    where: { organizationId: userId },
  })
  if (legacyEp) {
    const jcp = await prisma.jobCompanyProfile.findUnique({
      where: { enterpriseId: legacyEp.id },
    })
    const workspace = jcp ? await prisma.enterpriseJobWorkspace.findFirst({
      where: { enterpriseId: jcp.id },
    }) : null
    return {
      enterpriseId: legacyEp.id,
      role: 'owner',
      status: 'ACTIVE',
      source: 'legacy_migration',
      memberSource: resolveMemberSource('legacy_migration'),
      enterpriseProfile: {
        id: legacyEp.id,
        organizationId: legacyEp.organizationId,
        industry: legacyEp.industry,
        businessSummary: legacyEp.businessSummary,
        onboardingStep: legacyEp.onboardingStep,
        onboardingDone: legacyEp.onboardingDone,
      },
      jobCompanyProfile: jcp ? { id: jcp.id, enterpriseId: jcp.enterpriseId } : null,
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        status: workspace.status,
      } : null,
    }
  }

  // ─── 5. Migration (govUser → Organization) ───
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (user?.email) {
    const govUser = await prisma.govUser.findFirst({
      where: { email: user.email },
      select: { tenantId: true },
    })
    if (govUser?.tenantId) {
      const slugHash = govUser.tenantId.replace(/-/g, '').slice(0, 20)
      const org = await prisma.organization.findFirst({
        where: { slug: `migrated-${slugHash}` },
      })
      if (org) {
        const ep = await prisma.enterpriseProfile.findFirst({
          where: { organizationId: org.id },
        })
        const jcp = ep ? await prisma.jobCompanyProfile.findUnique({
          where: { enterpriseId: ep.id },
        }) : null
        const workspace = jcp ? await prisma.enterpriseJobWorkspace.findFirst({
          where: { enterpriseId: jcp.id },
        }) : null
        console.log('[EnterpriseContext] resolve source: migrated — userId:', userId)
        return {
          enterpriseId: org.id,
          role: 'owner',
          status: 'ACTIVE',
          source: 'migrated',
          memberSource: resolveMemberSource('migrated'),
          enterpriseProfile: ep ? {
            id: ep.id,
            organizationId: ep.organizationId,
            industry: ep.industry,
            businessSummary: ep.businessSummary,
            onboardingStep: ep.onboardingStep,
            onboardingDone: ep.onboardingDone,
          } : null,
          jobCompanyProfile: jcp ? { id: jcp.id, enterpriseId: jcp.enterpriseId } : null,
          workspace: workspace ? {
            id: workspace.id,
            name: workspace.name,
            plan: workspace.plan,
            status: workspace.status,
          } : null,
        }
      }
    }
  }

  return null
}

/**
 * 获取企业 ID（简化版，仅返回 ID）
 * 用于只需要 enterpriseId 的场景
 */
export async function resolveEnterpriseId(userId: string): Promise<string | null> {
  const ctx = await resolveCurrentEnterprise(userId)
  return ctx?.enterpriseId || null
}

/**
 * Workspace Tenant Boundary Guard
 * Observation Sprint Step 1-B-2:
 * 校验 workspaceId 属于当前用户的企业，防止跨租户越权访问。
 *
 * @param userId - JWT 用户 ID
 * @param workspaceId - 前端传入的 workspaceId
 * @returns { workspace, enterpriseId } | null — 校验失败返回 null
 */
export async function requireEnterpriseWorkspaceContext(
  userId: string,
  workspaceId: string | undefined,
): Promise<{ workspace: { id: string; name: string; enterpriseId: string }; enterpriseId: string } | null> {
  if (!workspaceId) return null

  const ctx = await resolveCurrentEnterprise(userId)
  if (!ctx) return null

  const workspace = await prisma.enterpriseJobWorkspace.findFirst({
    where: { id: workspaceId, enterpriseId: ctx.enterpriseId },
    select: { id: true, name: true, enterpriseId: true },
  })

  if (!workspace) return null

  return { workspace, enterpriseId: ctx.enterpriseId }
}
