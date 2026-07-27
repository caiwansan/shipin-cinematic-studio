/**
 * routes/studio-team.ts — AI Creative Team Collaboration (Sprint 2-04)
 *
 * 团队协作：Owner + Role 模型
 * 🎬 导演 ✍️ 编剧 🎨 美术 🎞 剪辑 👁 审核
 *
 * GET    /api/v1/studio/team/:projectId       — 获取团队列表
 * POST   /api/v1/studio/team/invite           — 邀请成员
 * POST   /api/v1/studio/team/accept-invite    — 接受邀请（via token）
 * PUT    /api/v1/studio/team/:projectId/:memberId — 修改角色
 * DELETE /api/v1/studio/team/:projectId/:memberId — 移除成员
 * GET    /api/v1/studio/team/invite/:token    — 查看邀请详情
 */

import type { ApiResponse } from '../contracts/api/base.js'
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import crypto from 'crypto'

// ── Role Config ──────────────────────────────────────────
const VALID_ROLES = ['director', 'writer', 'designer', 'editor', 'reviewer', 'viewer'] as const
type Role = typeof VALID_ROLES[number]

const ROLE_LABELS: Record<Role, { label: string; icon: string }> = {
  director:  { label: '导演', icon: '🎬' },
  writer:    { label: '编剧', icon: '✍️' },
  designer:  { label: '美术', icon: '🎨' },
  editor:    { label: '剪辑', icon: '🎞' },
  reviewer:  { label: '审核', icon: '👁' },
  viewer:    { label: '访客', icon: '👀' },
}

// ── Permission Helper ────────────────────────────────────
function canManageTeam(role: string | null): boolean {
  return role === 'owner' || role === 'director'
}

function canInvite(role: string | null): boolean {
  return role === 'owner' || role === 'director'
}

/**
 * Get the user's role in a project.
 * Returns 'owner' if user is the project owner, or the StudioProjectMember role.
 */
async function getUserProjectRole(projectId: string, userId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return null
  if (project.userId === userId) return 'owner'
  const member = await prisma.studioProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
  return member?.role || null
}

// ══════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════

export default async function studioTeamRoutes(fastify: FastifyInstance) {

  // ── GET /api/v1/studio/team/:projectId ──────────────
  fastify.get<{ Params: { projectId: string } }>(
    '/api/v1/studio/team/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId } = request.params

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })
      if (project.userId !== user.id) {
        const member = await prisma.studioProjectMember.findUnique({
          where: { projectId_userId: { projectId, userId: user.id } },
        })
        if (!member) return reply.status(403).send({ error: '无权访问' })
      }

      // Get owner info
      const owner = await prisma.user.findUnique({
        where: { id: project.userId },
        select: { id: true, username: true, email: true },
      })

      // Get team members
      const members = await prisma.studioProjectMember.findMany({
        where: { projectId, status: 'active' },
        include: { user: { select: { id: true, username: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      })

      return {
        success: true,
        data: {
          projectId: project.id,
          projectName: project.name,
          owner: owner ? {
            id: owner.id,
            username: owner.username,
            email: owner.email,
            role: 'owner',
            roleLabel: '所有者',
            roleIcon: '👑',
          } : null,
          members: members.map(m => ({
            id: m.id,
            userId: m.user.id,
            username: m.user.username,
            email: m.user.email,
            role: m.role,
            roleLabel: ROLE_LABELS[m.role as Role]?.label || m.role,
            roleIcon: ROLE_LABELS[m.role as Role]?.icon || '👤',
            status: m.status,
            joinedAt: m.createdAt,
          })),
          totalMembers: members.length + 1, // +1 for owner
        }
      } satisfies ApiResponse<unknown>
    }
  )

  // ── POST /api/v1/studio/team/invite ──────────────────
  fastify.post<{ Body: { projectId: string; email: string; role?: string } }>(
    '/api/v1/studio/team/invite',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId, email, role = 'viewer' } = request.body

      // Validate
      if (!projectId || !email) {
        return reply.status(400).send({ error: '缺少 projectId 或 email' })
      }
      if (!VALID_ROLES.includes(role as Role)) {
        return reply.status(400).send({ error: `无效角色，可选: ${VALID_ROLES.join(', ')}` })
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })

      // Permission check
      const userRole = await getUserProjectRole(projectId, user.id)
      if (!canInvite(userRole)) {
        return reply.status(403).send({ error: '只有导演或所有者可以邀请成员' })
      }

      // Check if user already in project
      const targetUser = await prisma.user.findUnique({ where: { email } })
      if (targetUser) {
        if (targetUser.id === project.userId) {
          return reply.status(400).send({ error: '用户已是项目所有者' })
        }
        const existing = await prisma.studioProjectMember.findUnique({
          where: { projectId_userId: { projectId, userId: targetUser.id } },
        })
        if (existing && existing.status === 'active') {
          return reply.status(400).send({ error: '用户已在团队中' })
        }
      }

      // Check existing pending invite
      const existingInvite = await prisma.studioInvite.findFirst({
        where: { projectId, email, status: 'pending' },
      })
      if (existingInvite) {
        return reply.status(400).send({ error: '该邮箱已有待处理的邀请' })
      }

      // Generate invite token
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const invite = await prisma.studioInvite.create({
        data: {
          projectId,
          email,
          role,
          token,
          invitedBy: user.id,
          status: 'pending',
          expiresAt,
        },
      })

      return {
        success: true,
        data: {
          inviteId: invite.id,
          email: invite.email,
          role: invite.role,
          roleLabel: ROLE_LABELS[invite.role as Role]?.label || invite.role,
          token: invite.token,
          expiresAt: invite.expiresAt,
        }
      } satisfies ApiResponse<unknown>
    }
  )

  // ── POST /api/v1/studio/team/accept-invite ───────────
  fastify.post<{ Body: { token: string } }>(
    '/api/v1/studio/team/accept-invite',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { token } = request.body

      if (!token) return reply.status(400).send({ error: '缺少 token' })

      const invite = await prisma.studioInvite.findUnique({ where: { token } })
      if (!invite) return reply.status(404).send({ error: '邀请不存在' })
      if (invite.status !== 'pending') {
        return reply.status(400).send({ error: `邀请已${invite.status === 'accepted' ? '接受' : '过期'}` })
      }
      if (invite.expiresAt < new Date()) {
        await prisma.studioInvite.update({
          where: { id: invite.id },
          data: { status: 'expired' },
        })
        return reply.status(410).send({ error: '邀请已过期' })
      }

      // Verify email matches
      if (invite.email !== user.email) {
        return reply.status(403).send({ error: '邀请邮箱与当前用户不匹配' })
      }

      // Add user to team
      const project = await prisma.project.findUnique({ where: { id: invite.projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })

      // Check if already a member
      const existing = await prisma.studioProjectMember.findUnique({
        where: { projectId_userId: { projectId: invite.projectId, userId: user.id } },
      })
      if (existing && existing.status === 'active') {
        return reply.status(400).send({ error: '你已是团队成员' })
      }

      // Create or reactivate membership
      if (existing) {
        await prisma.studioProjectMember.update({
          where: { id: existing.id },
          data: { role: invite.role, status: 'active' },
        })
      } else {
        await prisma.studioProjectMember.create({
          data: {
            projectId: invite.projectId,
            userId: user.id,
            role: invite.role,
            invitedBy: invite.invitedBy,
            status: 'active',
          },
        })
      }

      // Mark invite as accepted
      await prisma.studioInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      })

      return {
        success: true,
        data: {
          projectId: invite.projectId,
          projectName: project.name,
          role: invite.role,
          roleLabel: ROLE_LABELS[invite.role as Role]?.label || invite.role,
        }
      } satisfies ApiResponse<unknown>
    }
  )

  // ── GET /api/v1/studio/team/invite/:token ────────────
  fastify.get<{ Params: { token: string } }>(
    '/api/v1/studio/team/invite/:token',
    async (request, reply) => {
      const { token } = request.params

      const invite = await prisma.studioInvite.findUnique({
        where: { token },
        include: {
          project: { select: { id: true, name: true } },
        },
      })

      if (!invite) return reply.status(404).send({ error: '邀请不存在' })

      const isExpired = invite.expiresAt < new Date()
      const isPending = invite.status === 'pending' && !isExpired

      return {
        success: true,
        data: {
          projectName: invite.project.name,
          role: invite.role,
          roleLabel: ROLE_LABELS[invite.role as Role]?.label || invite.role,
          status: isExpired ? 'expired' : invite.status,
          expiresAt: invite.expiresAt,
          isPending,
        }
      } satisfies ApiResponse<unknown>
    }
  )

  // ── PUT /api/v1/studio/team/:projectId/:memberId ─────
  fastify.put<{
    Params: { projectId: string; memberId: string }
    Body: { role: string }
  }>(
    '/api/v1/studio/team/:projectId/:memberId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId, memberId } = request.params
      const { role } = request.body

      if (!VALID_ROLES.includes(role as Role)) {
        return reply.status(400).send({ error: `无效角色，可选: ${VALID_ROLES.join(', ')}` })
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })

      const userRole = await getUserProjectRole(projectId, user.id)
      if (!canManageTeam(userRole)) {
        return reply.status(403).send({ error: '无权修改团队成员角色' })
      }

      const member = await prisma.studioProjectMember.findUnique({
        where: { id: memberId },
      })
      if (!member || member.projectId !== projectId) {
        return reply.status(404).send({ error: '成员不存在' })
      }

      const updated = await prisma.studioProjectMember.update({
        where: { id: memberId },
        data: { role },
      })

      return {
        success: true,
        data: {
          id: updated.id,
          role: updated.role,
          roleLabel: ROLE_LABELS[updated.role as Role]?.label || updated.role,
          roleIcon: ROLE_LABELS[updated.role as Role]?.icon || '👤',
        }
      } satisfies ApiResponse<unknown>
    }
  )

  // ── DELETE /api/v1/studio/team/:projectId/:memberId ──
  fastify.delete<{ Params: { projectId: string; memberId: string } }>(
    '/api/v1/studio/team/:projectId/:memberId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId, memberId } = request.params

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })

      const userRole = await getUserProjectRole(projectId, user.id)
      if (!canManageTeam(userRole)) {
        return reply.status(403).send({ error: '无权移除团队成员' })
      }

      const member = await prisma.studioProjectMember.findUnique({
        where: { id: memberId },
      })
      if (!member || member.projectId !== projectId) {
        return reply.status(404).send({ error: '成员不存在' })
      }

      // Soft delete: mark as removed
      await prisma.studioProjectMember.update({
        where: { id: memberId },
        data: { status: 'removed' },
      })

      return { success: true, data: { message: '成员已移除' } } satisfies ApiResponse<unknown>
    }
  )
}
