/**
 * routes/channels.ts — BETA-07.1 Channel Identity Model
 *
 * 三层模型：
 *   ChannelAccount（渠道账号）→ ChannelBinding（AI员工绑定）→ Authorization Log
 *
 * 设计原则：
 *   - 渠道账号属于企业，不属于个人
 *   - 权限粒度到 AI 员工级别
 *   - 每个操作记录审计日志
 *   - 为未来对接真实 API 预留 credentials 字段
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { isValidUUID } from '../lib/uuid-validate.js'

export default async function channelRoutes(fastify: FastifyInstance) {

  // 🛡️ BETA-06.9.5: Channel 路由复用全局 Tenant Guard
  // 所有渠道操作必须登录且有组织（demo token 自动注入 demo 组织）

  // ──────────────────────────────────────────────
  // GET /api/enterprise/channel-accounts — 获取企业渠道列表
  // ──────────────────────────────────────────────
  fastify.get('/api/enterprise/channel-accounts', async (request) => {
    // BETA-06.9.5: 使用 Tenant Guard 注入的 orgId，禁止 query param 覆盖
    const orgId = ((request as any).tenantContext as any).orgId

    const channels = await prisma.channelAccount.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { bindings: true } },
      },
    })

    return {
      code: 0,
      data: {
        organizationId: orgId,
        channels: channels.map((ch) => ({
          id: ch.id,
          platform: ch.platform,
          accountName: ch.accountName,
          accountIdentifier: ch.accountIdentifier,
          accountType: ch.accountType,
          status: ch.status,
          bindingCount: ch._count.bindings,
          connectedAt: ch.connectedAt,
          lastVerifiedAt: ch.lastVerifiedAt,
          metadata: ch.metadata ? JSON.parse(ch.metadata) : {},
        })),
      },
    }
  })

  // ──────────────────────────────────────────────
  // POST /api/enterprise/channels — 添加渠道账号
  // ──────────────────────────────────────────────
  fastify.post('/api/enterprise/channel-accounts', async (request, reply) => {
    const { platform, accountName, accountIdentifier, accountType } = request.body as any
    const orgId = ((request as any).tenantContext as any).orgId

    if (!platform || !accountName) {
      return reply.status(400).send({ code: 1, message: '平台和账号名称必填' })
    }

    // 检查同组织同平台是否已有相同账号
    const existing = await prisma.channelAccount.findFirst({
      where: { organizationId: orgId, platform, accountName },
    })
    if (existing) {
      return reply.status(409).send({ code: 2, message: '该渠道账号已存在' })
    }

    const channel = await prisma.channelAccount.create({
      data: {
        organizationId: orgId,
        platform,
        accountName,
        accountIdentifier: accountIdentifier || null,
        accountType: accountType || 'creator',
        status: 'pending',
        metadata: '{}',
      },
    })

    // 审计日志
    await prisma.channelAuthorizationLog.create({
      data: {
        organizationId: orgId,
        channelAccountId: channel.id,
        action: 'connect',
        actor: 'admin',
        details: JSON.stringify({ platform, accountName }),
      },
    })

    return { code: 0, data: { channel }, message: '渠道账号已添加' }
  })

  // ──────────────────────────────────────────────
  // GET /api/enterprise/channel-accounts/:id/bindings — 获取渠道的 AI 员工绑定
  // ──────────────────────────────────────────────
  fastify.get('/api/enterprise/channel-accounts/:id/bindings', async (request) => {
    const { id } = request.params as any

    const bindings = await prisma.channelBinding.findMany({
      where: { channelAccountId: id },
      include: {
        agentInstance: {
          include: {
            profile: { select: { name: true, positionType: true } },
          },
        },
      },
    })

    return {
      code: 0,
      data: {
        bindings: bindings.map((b) => ({
          id: b.id,
          agentInstanceId: b.agentInstanceId,
          agentName: b.agentInstance?.profile?.name || '未知 AI',
          agentType: b.agentInstance?.profile?.positionType || 'unknown',
          permissions: b.permissions || [],
          status: b.status,
          boundAt: b.boundAt,
        })),
      },
    }
  })

  // ──────────────────────────────────────────────
  // POST /api/enterprise/channel-accounts/bindings — 绑定 AI 员工到渠道
  // ──────────────────────────────────────────────
  fastify.post('/api/enterprise/channel-accounts/bindings', async (request, reply) => {
    const { channelAccountId, agentInstanceId, permissions } = request.body as any
    const orgId = ((request as any).tenantContext as any).orgId

    if (!channelAccountId || !agentInstanceId) {
      return reply.status(400).send({ code: 1, message: '渠道账号和 AI 员工 ID 必填' })
    }

    // 检查渠道归属
    const channel = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, organizationId: orgId },
    })
    if (!channel) {
      return reply.status(403).send({ code: 2, message: '无权操作该渠道账号' })
    }

    // 检查 AI 员工归属
    const agent = await prisma.enterpriseAgentInstance.findFirst({
      where: { id: agentInstanceId, tenantId: orgId },
    })
    if (!agent) {
      return reply.status(403).send({ code: 2, message: '无权操作该 AI 员工' })
    }

    // 检查是否已绑定
    const existing = await prisma.channelBinding.findFirst({
      where: { channelAccountId, agentInstanceId },
    })
    if (existing) {
      return reply.status(409).send({ code: 3, message: '该 AI 员工已绑定此渠道' })
    }

    const defaultPermissions = permissions || ['READ']
    const binding = await prisma.channelBinding.create({
      data: {
        channelAccountId,
        agentInstanceId,
        permissions: defaultPermissions,
        bindingType: 'direct',
        status: 'active',
      },
    })

    await prisma.channelAuthorizationLog.create({
      data: {
        organizationId: orgId,
        channelAccountId,
        agentInstanceId,
        action: 'bind',
        actor: 'admin',
        details: JSON.stringify({ permissions: defaultPermissions }),
      },
    })

    return { code: 0, data: { binding }, message: '绑定成功' }
  })

  // ──────────────────────────────────────────────
  // DELETE /api/enterprise/channel-accounts/bindings/:id — 解绑 AI 员工
  // ──────────────────────────────────────────────
  fastify.delete('/api/enterprise/channel-accounts/bindings/:id', async (request, reply) => {
    const { id } = request.params as any
    const orgId = ((request as any).tenantContext as any).orgId

    const binding = await prisma.channelBinding.findFirst({
      where: { id },
      include: { channelAccount: true },
    })
    if (!binding || binding.channelAccount.organizationId !== orgId) {
      return reply.status(404).send({ code: 1, message: '绑定不存在' })
    }

    // 软删除：标记 revoked + 记录解绑时间
    await prisma.channelBinding.update({
      where: { id },
      data: { status: 'revoked', unboundAt: new Date() },
    })

    await prisma.channelAuthorizationLog.create({
      data: {
        organizationId: orgId,
        channelAccountId: binding.channelAccountId,
        agentInstanceId: binding.agentInstanceId,
        action: 'unbind',
        actor: 'admin',
        details: '{}',
      },
    })

    return { code: 0, message: '已解绑' }
  })

  // ──────────────────────────────────────────────
  // POST /api/enterprise/channel-accounts/:id/connect — REALITY-GATE-FINAL-01 Task03 已下线
  // 原实现为模拟授权（fakeToken + simulated:true），违反「真实或不存在」原则。
  // 真实连接请使用新链路：/api/enterprise/channels/runtime/:id/connect（BrowserWorkspace 真机扫码）
  // ──────────────────────────────────────────────
  fastify.post('/api/enterprise/channel-accounts/:id/connect', async (_request, reply) => {
    return reply.status(410).send({ code: 410, message: '模拟授权已下线：请使用真实扫码链路 /api/enterprise/channels/runtime/:id/connect' })
  })

  // ──────────────────────────────────────────────
  // DELETE /api/enterprise/channel-accounts/:id — 断开渠道连接
  // ──────────────────────────────────────────────
  fastify.delete('/api/enterprise/channel-accounts/:id', async (request, reply) => {
    const { id } = request.params as any
    const orgId = ((request as any).tenantContext as any).orgId

    const channel = await prisma.channelAccount.findFirst({
      where: { id, organizationId: orgId },
    })
    if (!channel) {
      return reply.status(404).send({ code: 1, message: '渠道账号不存在' })
    }

    await prisma.channelAccount.update({
      where: { id },
      data: {
        status: 'disconnected',
        credentials: '{}',
        disconnectedAt: new Date(),
      },
    })

    // 同时解绑所有 AI 员工
    await prisma.channelBinding.updateMany({
      where: { channelAccountId: id },
      data: { status: 'revoked', unboundAt: new Date() },
    })

    await prisma.channelAuthorizationLog.create({
      data: {
        organizationId: orgId,
        channelAccountId: id,
        action: 'disconnect',
        actor: 'admin',
        details: '{}',
      },
    })

    return { code: 0, message: '已断开渠道连接' }
  })

  // ──────────────────────────────────────────────
  // GET /api/enterprise/channel-accounts/agents — 获取企业 AI 员工列表（用于绑定选择）
  // ──────────────────────────────────────────────
  fastify.get('/api/enterprise/channel-accounts/agents', async (request) => {
    const orgId = ((request as any).tenantContext as any).orgId

    const agents = await prisma.enterpriseAgentInstance.findMany({
      where: { tenantId: orgId },
      include: {
        profile: { select: { name: true, positionType: true, capabilities: true } },
      },
    })

    return {
      code: 0,
      data: {
        agents: agents.map((a) => ({
          id: a.id,
          name: a.profile?.name || 'AI 员工',
          type: a.profile?.positionType || 'unknown',
          status: a.runtimeStatus,
          capabilities: a.profile?.capabilities ? JSON.parse(a.profile.capabilities) : [],
        })),
      },
    }
  })
}
