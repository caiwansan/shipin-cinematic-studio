/**
 * identity-context.routes.ts — Identity Context Service
 *
 * Sprint-08: 统一身份上下文服务
 * GET /api/identity/context → { user, workspace, enterprise, membership, subscription }
 *
 * 唯一合法获取当前用户身份/企业/工作空间上下文的入口。
 * 所有 Tenant 判断都来自数据库，不依赖 localStorage。
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function identityContextRoutes(fastify: FastifyInstance) {

  // ─── 当前用户身份上下文 ───
  fastify.get('/api/identity/context', async (request, reply) => {
    try {
      // 1. Verify JWT and get userId
      let decoded: any
      try {
        decoded = await request.jwtVerify()
      } catch (jwtError: any) {
        return reply.status(401).send({ error: '认证令牌无效或已过期' })
      }

      const userId = (decoded as any)?.id || (decoded as any)?.userId
      if (!userId) {
        return reply.status(401).send({ error: '令牌中无用户标识' })
      }

      // 2. Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          memberTier: true,
          createdAt: true,
        },
      })

      if (!user) {
        return reply.status(404).send({ error: '用户不存在' })
      }

      // 3. Find enterprise profile
      // 优先级: EnterpriseMember (最直接的 User → Enterprise 链接) > onboard- 组织 > 旧模型 > 迁移模型
      let enterpriseProfile: any = null
      let jobProfile: any = null
      let membershipInfo: any = null

      // 3a. 首选: 通过 EnterpriseMember 查找 (最直接的 User → Enterprise 链接)
      const entMember = await prisma.enterpriseMember.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },  // 取最新的
      })
      if (entMember) {
        const jcp = await prisma.jobCompanyProfile.findUnique({
          where: { id: entMember.enterpriseId },
        })
        if (jcp) {
          enterpriseProfile = await prisma.enterpriseProfile.findUnique({
            where: { id: jcp.enterpriseId },
          })
          jobProfile = jcp
          membershipInfo = {
            role: entMember.role,
            isAdmin: entMember.role === 'OWNER',
            source: 'enterprise_member',
          }
        }
      }

      // 3b. Fallback: 通过 onboarding 创建的 Organization (slug 以 onboard- 开头)
      if (!enterpriseProfile) {
        const onboardOrg = await prisma.organization.findFirst({
          where: { ownerId: userId, slug: { startsWith: 'onboard-' } },
          orderBy: { createdAt: 'desc' },
        })
        if (onboardOrg) {
          enterpriseProfile = await prisma.enterpriseProfile.findFirst({
            where: { organizationId: onboardOrg.id },
          })
          if (enterpriseProfile) {
            jobProfile = await prisma.jobCompanyProfile.findUnique({
              where: { enterpriseId: enterpriseProfile.id },
            })
            membershipInfo = { role: 'owner', isAdmin: true, source: 'onboarding' }
          }
        }
      }

      // 3c. Fallback: 旧模型 (organizationId = userId)
      if (!enterpriseProfile) {
        enterpriseProfile = await prisma.enterpriseProfile.findFirst({
          where: { organizationId: userId },
        })
        if (enterpriseProfile) {
          jobProfile = await prisma.jobCompanyProfile.findUnique({
            where: { enterpriseId: enterpriseProfile.id },
          })
          membershipInfo = { role: 'owner', isAdmin: true, source: 'legacy' }
        }
      }

      // 3d. Fallback: 迁移模型 (govUser → Organization)
      if (!enterpriseProfile) {
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
            enterpriseProfile = await prisma.enterpriseProfile.findFirst({
              where: { organizationId: org.id },
            })
            if (enterpriseProfile) {
              jobProfile = await prisma.jobCompanyProfile.findUnique({
                where: { enterpriseId: enterpriseProfile.id },
              })
              membershipInfo = { role: 'owner', isAdmin: true, source: 'migrated' }
            }
          }
        }
      }

      // 3e. Fetch workspace if enterprise exists
      let workspace: any = null
      if (enterpriseProfile && jobProfile) {
        const ws = await prisma.enterpriseJobWorkspace.findFirst({
          where: { enterpriseId: jobProfile.id },
        })
        workspace = ws
          ? { id: ws.id, name: ws.name, plan: ws.plan, status: ws.status }
          : null
      }

      // 4. Get subscription info
      const subscription = await prisma.enterpriseSubscription.findFirst({
        where: { organizationId: userId },
        include: { plan: true },
      })

      // 5. Build context
      if (!enterpriseProfile) {
        return {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              memberTier: user.memberTier,
              createdAt: user.createdAt,
            },
            hasEnterprise: false,
            enterprise: null,
            workspace: null,
            membership: null,
            subscription: subscription ? {
              id: subscription.id,
              status: subscription.status,
              plan: subscription.plan ? {
                id: subscription.plan.id,
                name: subscription.plan.name,
                displayName: subscription.plan.displayName,
                maxEmployees: subscription.plan.maxEmployees,
                maxChannels: subscription.plan.maxChannels,
              } : null,
              expireAt: subscription.expireAt,
            } : null,
          },
        }
      }

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            memberTier: user.memberTier,
            createdAt: user.createdAt,
          },
          hasEnterprise: true,
          enterprise: {
            id: jobProfile?.id || enterpriseProfile.id,
            name: enterpriseProfile.businessSummary || enterpriseProfile.industry || '我的企业',
            industry: enterpriseProfile.industry,
            onboardingStep: enterpriseProfile.onboardingStep,
            onboardingDone: enterpriseProfile.onboardingDone,
          },
          workspace: workspace ? {
            id: workspace.id,
            name: workspace.name,
            plan: workspace.plan,
            status: workspace.status,
          } : null,
          membership: membershipInfo ? {
            role: membershipInfo.role,
            isAdmin: membershipInfo.isAdmin,
            source: membershipInfo.source,
          } : {
            role: 'owner',
            isAdmin: true,
            source: 'default',
          },
          subscription: subscription ? {
            id: subscription.id,
            status: subscription.status,
            plan: subscription.plan ? {
              id: subscription.plan.id,
              name: subscription.plan.name,
              displayName: subscription.plan.displayName,
              maxEmployees: subscription.plan.maxEmployees,
              maxChannels: subscription.plan.maxChannels,
            } : null,
            expireAt: subscription.expireAt,
          } : null,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取身份上下文失败', detail: e.message })
    }
  })

  // ─── 获取用户可访问的工作空间列表 ───
  fastify.get('/api/identity/workspaces', async (request, reply) => {
    try {
      let decoded: any
      try {
        decoded = await request.jwtVerify()
      } catch (jwtError: any) {
        return reply.status(401).send({ error: '认证令牌无效或已过期' })
      }

      const userId = (decoded as any)?.id || (decoded as any)?.userId
      if (!userId) {
        return reply.status(401).send({ error: '令牌中无用户标识' })
      }

      // Find all enterprise profiles for this user
      const enterpriseProfiles = await prisma.enterpriseProfile.findMany({
        where: { organizationId: userId },
      })

      const workspaces: any[] = []
      for (const ep of enterpriseProfiles) {
        const ws = await prisma.enterpriseJobWorkspace.findFirst({
          where: { enterpriseId: ep.id },
        })
        if (ws) {
          workspaces.push({
            id: ws.id,
            name: ws.name,
            enterpriseId: ep.id,
            enterpriseName: ep.businessSummary || ep.industry || '我的企业',
            plan: ws.plan,
            status: ws.status,
          })
        }
      }

      return { success: true, data: workspaces }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取工作空间列表失败', detail: e.message })
    }
  })

  // ─── 切换工作空间 ───
  fastify.post('/api/identity/workspace/switch', async (request, reply) => {
    try {
      let decoded: any
      try {
        decoded = await request.jwtVerify()
      } catch (jwtError: any) {
        return reply.status(401).send({ error: '认证令牌无效或已过期' })
      }

      const userId = (decoded as any)?.id || (decoded as any)?.userId
      if (!userId) {
        return reply.status(401).send({ error: '令牌中无用户标识' })
      }

      const { workspaceId } = request.body as { workspaceId?: string }
      if (!workspaceId) {
        return reply.status(400).send({ error: 'workspaceId 是必填' })
      }

      // Verify workspace exists
      const workspace = await prisma.enterpriseJobWorkspace.findFirst({
        where: { id: workspaceId },
      })

      if (!workspace) {
        return reply.status(403).send({ error: '无权访问该工作空间' })
      }

      // Check if user has access (workspace belongs to user's enterprise)
      const enterpriseProfile = await prisma.enterpriseProfile.findFirst({
        where: {
          id: workspace.enterpriseId,
          organizationId: userId,
        },
      })

      if (!enterpriseProfile) {
        return reply.status(403).send({ error: '无权访问该工作空间' })
      }

      // Get subscription info
      const subscription = await prisma.enterpriseSubscription.findFirst({
        where: { organizationId: userId },
        include: { plan: true },
      })

      return {
        success: true,
        data: {
          workspace: {
            id: workspace.id,
            name: workspace.name,
            plan: workspace.plan,
            status: workspace.status,
          },
          enterprise: {
            id: enterpriseProfile.id,
            name: enterpriseProfile.businessSummary || enterpriseProfile.industry || '我的企业',
            industry: enterpriseProfile.industry,
          },
          subscription: subscription ? {
            id: subscription.id,
            status: subscription.status,
            plan: subscription.plan ? {
              id: subscription.plan.id,
              name: subscription.plan.name,
              displayName: subscription.plan.displayName,
            } : null,
          } : null,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '切换工作空间失败', detail: e.message })
    }
  })
}
