/**
 * Channel Reality API — SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 Task 05
 *
 * GET /api/enterprise/channels/:id/reality
 *
 * 四层真实状态（AI 员工执行前必查；老板验证「电脑/登录/授权/员工」是否真正可用）：
 * {
 *   browser:  { alive, profileExists }                    — 电脑是否开机 + profile 是否存在
 *   identity: { loggedIn, nickname, externalAccountId, avatar, checkedAt } — 实时探针（三信号）
 *   account:  { connected, connectionStatus, connectedAt }— SaaS 授权状态
 *   employee: { usable, binding }                         — AI 员工是否可用的最终结论
 * }
 *
 * 设计原则：
 * - identity 是实时 IdentityProbe 结果（不猜、不用 DB 快照冒充）
 * - usable = account.connected && identity.loggedIn && binding.active（全部真实才可用）
 * - 租户/组织归属校验：非属主账号一律 404（第三方审计 H-02 教训，新代码从第一天就带校验）
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { browserRuntime } from '../services/media/browser-runtime.service.js'
import { identityProbeRegistry } from '../enterprise/channel/identity-probe.js'
import { browserWorkspaceService } from '../services/enterprise/browser-workspace.service.js'
import { isChannelConnected } from '../constants/channel-connection-status.js'

export async function channelRealityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/api/enterprise/channels/:id/reality', async (request, reply) => {
    try {
      const { id } = request.params as any
      const user = (request as any).user as any
      const tenantId = user?.tenantId || user?.id

      // ═══ 归属校验（审计 H-02 教训：跨租户读取/操作渠道账号是最高危越权）═══
      const account = await prisma.enterpriseChannelAccount.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          channelType: true,
          channelName: true,
          connectionStatus: true,
          externalAccountId: true,
          connectedAt: true,
          metadata: true,
        },
      })
      if (!account) return reply.status(404).send({ code: 1, message: '渠道账号不存在或无权访问' })

      const platform = account.channelType
      const sid = await browserWorkspaceService.resolveSessionId(account.id, platform)

      // ── 1. browser 层：实例存活 + profile 存在 ──
      const instances = browserRuntime.listInstances()
      const alive = instances.some(i => i.sessionId === sid)
      let profileExists = false
      try {
        const fs = await import('fs')
        const ws = await prisma.browserWorkspace.findUnique({ where: { channelAccountId: account.id } })
        profileExists = fs.existsSync(ws?.profilePath || browserRuntime.getProfilePath(platform, account.id))
      } catch {
        profileExists = false
      }

      // ── 2. identity 层：实时探针（页面特征 + Cookie + 身份提取）──
      let identity: { loggedIn: boolean; nickname: string | null; externalAccountId: string | null; avatar: string | null; checkedAt: string; signals?: unknown } = {
        loggedIn: false,
        nickname: null,
        externalAccountId: null,
        avatar: null,
        checkedAt: new Date().toISOString(),
      }
      if (alive) {
        const probe = identityProbeRegistry.get(platform)
        if (probe) {
          try {
            const r = await probe.probe(sid)
            identity = {
              loggedIn: !!r.authenticated && !!r.accountId,
              nickname: r.accountName ?? null,
              externalAccountId: r.accountId ?? null,
              avatar: r.avatar ?? null,
              checkedAt: r.checkedAt,
              signals: r.signals,
            }
          } catch (e: any) {
            identity.loggedIn = false
            identity.nickname = null
            identity.externalAccountId = null
            identity.avatar = null
            console.warn(`[ChannelReality] ${id} 探针异常: ${e.message}`)
          }
        }
      }

      // ── 3. account 层：SaaS 授权状态 ──
      const accountConnected = isChannelConnected(account.connectionStatus) && !!account.externalAccountId

      // ── 4. employee 层：AI 员工绑定 ──
      const binding = await prisma.agentChannelBinding.findFirst({
        where: { channelAccountId: account.id, status: 'active' },
        select: { agentInstanceId: true, permissions: true, updatedAt: true },
      })
      let bindingAgent: { id: string; name: string | null; role: string | null } | null = null
      if (binding) {
        const agent = await prisma.enterpriseAgentInstance.findUnique({
          where: { id: binding.agentInstanceId },
          select: { id: true, employeeId: true },
        })
        if (agent) {
          const profile = await prisma.enterpriseAgentProfile.findUnique({
            where: { id: agent.employeeId },
            select: { name: true, role: true },
          })
          bindingAgent = { id: agent.id, name: profile?.name ?? null, role: profile?.role ?? null }
        }
      }

      const usable = accountConnected && identity.loggedIn && !!binding?.agentInstanceId

      return reply.send({
        code: 0,
        data: {
          accountId: account.id,
          platform,
          checkedAt: new Date().toISOString(),
          browser: { alive, profileExists },
          identity,
          account: {
            connected: accountConnected,
            connectionStatus: account.connectionStatus,
            connectedAt: account.connectedAt ? account.connectedAt.toISOString() : null,
            accountName: account.channelName,
          },
          employee: {
            usable,
            binding: bindingAgent,
            permissionLevel: (account.metadata as any)?.permissionLevel ?? 1,
          },
        },
      })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })
}
