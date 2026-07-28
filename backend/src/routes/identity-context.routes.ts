/**
 * identity-context.routes.ts — Identity Context Service
 *
 * Sprint-08: 统一身份上下文服务
 * GET /api/identity/context → { user, workspace, enterprise, membership, subscription }
 *
 * Sprint-Enterprise-Identity-Hardening-01 Phase 3:
 * 使用 EnterpriseContextService 作为唯一解析入口。
 * 所有 organizationId:userId 回退已修复为通过 OrgMember 关联查询。
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { resolveCurrentEnterprise } from '../services/enterprise-context.service.js'

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

      // 3. 使用统一 EnterpriseContextService 解析企业上下文
      const ctx = await resolveCurrentEnterprise(userId)

      // 4. Get subscription info via org membership (not userId-as-orgId)
      // Find user's organization, then look up subscription by org ID
      let orgId: string | null = null
      let subscription: any = null

      if (ctx && (ctx as any).enterpriseId) {
        // Use organizationId from the resolved context
        orgId = (ctx as any).enterpriseId
      } else {
        // Fallback: find first org membership
        const memberShip = await prisma.orgMember.findFirst({
          where: { userId },
          select: { organizationId: true },
        })
        orgId = memberShip?.organizationId || null
      }

      if (orgId) {
        subscription = await prisma.enterpriseSubscription.findFirst({
          where: { organizationId: orgId },
          include: { plan: true },
        })
      }

      // 5. Build context
      if (!ctx) {
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
            id: ctx.enterpriseId,
            name: ctx.enterpriseProfile?.businessSummary || ctx.enterpriseProfile?.industry || '我的企业',
            industry: ctx.enterpriseProfile?.industry || null,
            onboardingStep: ctx.enterpriseProfile?.onboardingStep || 0,
            onboardingDone: ctx.enterpriseProfile?.onboardingDone || false,
          },
          workspace: ctx.workspace ? {
            id: ctx.workspace.id,
            name: ctx.workspace.name,
            plan: ctx.workspace.plan,
            status: ctx.workspace.status,
          } : null,
          membership: {
            role: ctx.role,
            isAdmin: ctx.role === 'OWNER' || ctx.role === 'owner',
            source: ctx.source,
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

      // Find user's organization memberships
      const orgMemberships = await prisma.orgMember.findMany({
        where: { userId },
        select: { organizationId: true },
      })

      const orgIds = orgMemberships.map(m => m.organizationId)
      if (orgIds.length === 0) {
        return { success: true, data: [] }
      }

      // Find enterprise profiles for those organizations
      const enterpriseProfiles = await prisma.enterpriseProfile.findMany({
        where: { organizationId: { in: orgIds } },
        select: {
          id: true,
          organizationId: true,
          businessSummary: true,
          industry: true,
        },
      })

      // Find workspaces for those enterprise profiles
      const epIds = enterpriseProfiles.map(ep => ep.id)
      const workspaces = await prisma.enterpriseJobWorkspace.findMany({
        where: { enterpriseId: { in: epIds } },
      })

      // Build workspace list with enterprise context
      const epMap = new Map(enterpriseProfiles.map(ep => [ep.id, ep]))
      const result = workspaces.map(ws => {
        const ep = epMap.get(ws.enterpriseId)
        return {
          id: ws.id,
          name: ws.name,
          enterpriseId: ws.enterpriseId,
          enterpriseName: ep?.businessSummary || ep?.industry || '我的企业',
          organizationId: ep?.organizationId,
          plan: ws.plan,
          status: ws.status,
        }
      })

      return { success: true, data: result }
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
      const workspace = await prisma.enterpriseJobWorkspace.findUnique({
        where: { id: workspaceId },
      })

      if (!workspace) {
        return reply.status(404).send({ error: '工作空间不存在' })
      }

      // Find the enterprise profile for this workspace
      const enterpriseProfile = await prisma.enterpriseProfile.findUnique({
        where: { id: workspace.enterpriseId },
        select: {
          id: true,
          organizationId: true,
          businessSummary: true,
          industry: true,
        },
      })

      if (!enterpriseProfile) {
        return reply.status(404).send({ error: '企业资料不存在' })
      }

      // Verify user has OrgMember access to this enterprise's organization
      const membership = await prisma.orgMember.findFirst({
        where: {
          userId,
          organizationId: enterpriseProfile.organizationId,
        },
      })

      if (!membership) {
        return reply.status(403).send({ error: '无权访问该工作空间' })
      }

      // Get subscription via org membership (not userId-as-orgId)
      const subscription = await prisma.enterpriseSubscription.findFirst({
        where: { organizationId: enterpriseProfile.organizationId },
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
          organizationId: enterpriseProfile.organizationId,
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
