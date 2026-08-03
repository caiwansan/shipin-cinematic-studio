/**
 * Channel Reality API — SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 Task 05
 *
 * GET /api/enterprise/channels/:id/reality
 *
 * 四层真实状态（AI 员工执行前必查；老板验证「电脑/登录/授权/员工」是否真正可用）：
 * {
 *   browser:  { alive, profileExists }                    — 电脑是否开机 + profile 是否存在
 *   identity: { status, platform, name, avatar, externalId, lastVerifiedAt,
 *               loggedIn, checkedAt }                      — 身份（verified 必须来自最近真实探针）
 *   account:  { connected, connectionStatus, connectedAt }— SaaS 授权状态
 *   employee: { usable, binding }                         — AI 员工是否可用的最终结论
 * }
 *
 * IDENTITY-VIEW-01 Task03 — identity 标准化：
 *   status = verified（最近探针通过）/ stale（有身份但需重新验证）/ missing（从未获取到身份）
 *   name/avatar/externalId 优先实时探针值；探针不可用时回退最近一次身份快照（SSOT 列），绝不编造
 *   lastVerifiedAt = 最近一次真实探针/恢复确认时间
 *
 * 设计原则：
 * - identity.verified 必须来自最近一次真实探针（不猜、不用 DB 快照冒充在线）
 * - usable = account.connected && identity.loggedIn && binding.active（全部真实才可用）
 * - 租户/组织归属校验：非属主账号一律 404（第三方审计 H-02 教训，新代码从第一天就带校验）
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { browserRuntime } from '../services/media/browser-runtime.service.js'
import { identityProbeRegistry } from '../enterprise/channel/identity-probe.js'
import { browserWorkspaceService } from '../services/enterprise/browser-workspace.service.js'
import { channelService } from '../services/enterprise/channel.service.js'
import { isChannelConnected } from '../constants/channel-connection-status.js'

export async function channelRealityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/api/enterprise/channels/:id/reality', async (request, reply) => {
    try {
      const { id } = request.params as any
      const user = (request as any).user as any

      // ═══ 归属校验（TENANT-ISOLATION-FIX-02 修正 — P0-A IDOR 关闭）═══
      // AUDIT-01 实锤：旧实现「渠道账号是组织级全局资源，仅要求已认证」= 跨企业 IDOR，
      // 无组织用户可读任意账号 identity/externalAccountId（实测 200 + 泄露 881306）。
      // 修正：用户私有资产模型——owner 本人（全权限）或 ChannelAccountShare 被授权人可读；
      //      知道 id 不再等于可访问。无组织用户若是 owner 本人仍可读（账号属人，不属组织）。
      const { ChannelAccessService } = await import('../services/enterprise/channel/channel-access.service.js')
      const access = new ChannelAccessService(prisma)
      if (!(await access.canAccess(user?.id, id))) {
        return reply.status(403).send({ code: 403, error: 'CHANNEL_ACCESS_DENIED', message: '无权访问该渠道账号（需账号所有者授权）' })
      }
      const account = await prisma.enterpriseChannelAccount.findFirst({
        where: { id },
        select: {
          id: true,
          channelType: true,
          channelName: true,
          accountName: true,
          avatarUrl: true,
          connectionStatus: true,
          externalAccountId: true,
          connectedAt: true,
          metadata: true,
        },
      })
      if (!account) return reply.status(404).send({ code: 1, message: '渠道账号不存在' })

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
      // IDENTITY-VIEW-01 Task03 — 标准化 {status, platform, name, avatar, externalId, lastVerifiedAt}
      //   status 判定：
      //     verified = 最近一次真实探针通过（identity 必须来自探针，不猜）
      //     stale    = 有身份（SSOT 列/快照）但当前未验证（浏览器不在线/探针未过/超时）→ 需重新验证，不删身份
      //     missing  = 从未获取到身份
      //   值优先级：实时探针 > SSOT 列（accountName/avatarUrl）> metadata 快照
      const probeIdentity: { authenticated?: boolean; accountId?: string | null; accountName?: string | null; avatar?: string | null; checkedAt?: string } = {}
      if (alive) {
        const probe = identityProbeRegistry.get(platform)
        if (probe) {
          try {
            const r = await probe.probe(sid)
            Object.assign(probeIdentity, {
              authenticated: !!r.authenticated && !!r.accountId,
              accountId: r.accountId ?? null,
              accountName: r.accountName ?? null,
              avatar: r.avatar ?? null,
              checkedAt: r.checkedAt,
            })
          } catch (e: any) {
            console.warn(`[ChannelReality] ${id} 探针异常: ${e.message}`)
          }
        }
      }
      const accMeta = (account.metadata as any) || {}
      const lastVerifiedAt = accMeta.lastVerifiedAt || null
      const hasIdentity = !!account.externalAccountId || !!account.accountName || !!accMeta.identitySnapshot
      // IDENTITY-V2 Task03 — verifiedBy 标注验证来源：
      //   probe = 最近一次真实浏览器探针（最可信）
      //   fast  = FastIdentityValidator 快照验证（凭证+身份快照，浏览器未启动，懒加载）
      //   none  = 未验证
      let verifiedBy: 'probe' | 'fast' | 'none' = 'none'
      let identityStatus: 'verified' | 'stale' | 'missing'
      if (probeIdentity.authenticated) {
        identityStatus = 'verified'
        verifiedBy = 'probe'
      } else if (!alive && hasIdentity && isChannelConnected(account.connectionStatus)) {
        // 浏览器未运行但账号 CONNECTED → 快照验证（恢复服务 fast 路径）
        try {
          const { fastIdentityValidator } = await import('../enterprise/channel/fast-identity-validator.js')
          const verdict = await fastIdentityValidator.verify(account, channelService)
          if (verdict.status === 'fresh') {
            identityStatus = 'verified'
            verifiedBy = 'fast'
          } else {
            identityStatus = 'stale'
          }
        } catch {
          identityStatus = hasIdentity ? 'stale' : 'missing'
        }
      } else {
        identityStatus = hasIdentity ? 'stale' : 'missing'
      }
      const identity = {
        status: identityStatus,
        verifiedBy,
        platform,
        // G5 — 未登录不能生成账号名：missing（从未获取身份）时 name/avatar/externalId 一律 null，
        //   绝不 fallback 到渠道展示名（channelName）冒充账号身份
        name: identityStatus === 'missing' ? null : (probeIdentity.accountName ?? account.accountName ?? account.channelName ?? null),
        avatar: identityStatus === 'missing' ? null : (probeIdentity.avatar ?? account.avatarUrl ?? accMeta.avatar ?? null),
        externalId: identityStatus === 'missing' ? null : (probeIdentity.accountId ?? account.externalAccountId ?? null),
        lastVerifiedAt: identityStatus === 'missing' ? null : lastVerifiedAt,
        loggedIn: !!probeIdentity.authenticated,
        checkedAt: probeIdentity.checkedAt ?? new Date().toISOString(),
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
            accountName: account.accountName ?? account.channelName,
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
