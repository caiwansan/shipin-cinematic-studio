/**
 * Phase 3: Growth Execution Layer
 * Enterprise Channel Service — 渠道管理服务
 *
 * 统一接口，支持：微信公众号、企业微信、抖音、小红书、快手
 * 遵循 EnterpriseChannelAdapter 接口规范
 */
import { prisma } from '../../utils/index.js'
import { randomUUID } from 'crypto'
import { encryptKey, decryptKey } from '../crypto.service.js'
import type {
  ChannelContent,
  PublishResult,
  PlatformInteraction,
  ChannelHealth,
  ChannelMetrics,
  EnterpriseChannelAdapter,
} from '../../enterprise/channel/channel.adapter.js'
import { ContentStatus } from '../../enterprise/channel/channel.adapter.js'
import { agentChannelBindingService } from './agent-channel-binding.service.js'
import { channelBrowserSessionService } from './channel-browser-session.service.js'
import { browserRuntime } from '../media/browser-runtime.service.js'
import { identityProbeRegistry } from '../../enterprise/channel/identity-probe.js'
import { CHANNEL_META } from '../../enterprise/channel/adapters/browser-channel.meta.js'
import {
  ChannelConnectionStatus,
  isChannelConnected,
} from '../../constants/channel-connection-status.js'

export class ChannelService {
  private adapters: Map<string, EnterpriseChannelAdapter> = new Map()

  /**
   * 注册渠道适配器
   */
  registerAdapter(adapter: EnterpriseChannelAdapter) {
    console.log(`[ChannelService] 注册渠道: ${adapter.platform}`)
    this.adapters.set(adapter.platform, adapter)
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — AdapterRegistry 渠道解析
   * channelType（如 douyin）→ 对应 EnterpriseChannelAdapter
   */
  resolveAdapter(platform: string): EnterpriseChannelAdapter {
    const adapter = this.adapters.get(platform)
    if (!adapter) {
      throw new Error(`未注册渠道适配器: ${platform}（请在 index.ts 注册 EnterpriseChannelAdapter 实现）`)
    }
    return adapter
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase D — AI 员工渠道操作授权（大脑层）
   * Adapter = 手脚（纯执行）｜ ChannelService = 大脑（权限校验）｜ AgentChannelBinding = 权限系统
   * 校验失败统一抛 code=permission_denied 错误
   */
  async authorizeAgentAction(agentInstanceId: string, channelAccountId: string, permission: string) {
    const r = await agentChannelBindingService.authorize(agentInstanceId, channelAccountId, permission)
    if (!r.allowed) {
      const err: any = new Error(
        r.reason === 'permission_denied'
          ? `AI 员工无权执行 ${permission} 操作（AgentChannelBinding.permissions.${permission}=false）`
          : `渠道绑定未就绪: ${r.reason}`,
      )
      err.code = 'permission_denied'
      throw err
    }
    return r
  }

  /**
   * TASK03.2.2 — 三级权限模型（掌柜蓝图：不要马上开放 AI 操作）
   *   L1 观察员工（默认）：读取数据 / 分析账号 / 生成建议
   *   L2 运营助理：生成内容 / 生成回复 / 生成排期（需老板批准）
   *   L3 运营经理：发布 / 回复 / 互动（明确授权 + 操作日志 + 可回滚）
   *
   * 权限等级持久化在 EnterpriseChannelAccount.metadata.permissionLevel（1/2/3）
   * 操作放行矩阵（operation → 所需最低等级）：
   *   read:metrics / read:comments / analyze → L1
   *   generate / draft / schedule → L2
   *   publish / reply / interact → L3
   */
  private readonly PERMISSION_MATRIX: Record<string, number> = {
    'read:metrics': 1,
    'read:comments': 1,
    analyze: 1,
    generate: 2,
    draft: 2,
    schedule: 2,
    publish: 3,
    reply: 3,
    interact: 3,
  }

  /** 读取账号当前权限等级（默认 L1） */
  async getPermissionLevel(accountId: string): Promise<number> {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    return (account.metadata as any)?.permissionLevel ?? 1
  }

  /**
   * SPRINT-MEDIA-ACCOUNT-IDENTITY-VIEW-01 Task01/02 — 渠道身份唯一写入入口（SSOT）
   * 来源唯一链路：IdentityProbe → updateChannelIdentity() → EnterpriseChannelAccount
   *
   * 写 SSOT 列：externalAccountId / accountName / avatarUrl
   * 同步维护：channelName（历史兼容展示名）+ metadata.lastVerifiedAt + metadata.identitySnapshot（身份新鲜度）
   *
   * 禁止：前端保存账号名 / workspace 保存账号名 / AI 员工保存账号名（AI 员工只是使用电脑，不拥有账号）
   *
   * @param input.via 身份来源标注（connect_keepalive / wait_login_keepalive / refresh_credential / recovery / confirm_binding）
   */
  async updateChannelIdentity(
    accountId: string,
    input: {
      externalAccountId?: string | null
      accountName?: string | null
      avatarUrl?: string | null
      via: string
      connectionStatus?: string
      connectedAt?: Date | null
    },
  ) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const nowIso = new Date().toISOString()
    const accMeta = (account.metadata as any) || {}
    const finalExternalId = input.externalAccountId ?? account.externalAccountId
    const finalName = input.accountName ?? account.accountName ?? account.channelName
    const finalAvatar = input.avatarUrl ?? account.avatarUrl ?? accMeta.avatar ?? null
    return prisma.enterpriseChannelAccount.update({
      where: { id: accountId },
      data: {
        ...(input.externalAccountId != null ? { externalAccountId: input.externalAccountId } : {}),
        ...(input.accountName != null ? { accountName: input.accountName, channelName: input.accountName } : {}),
        ...(input.avatarUrl != null ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.connectionStatus ? { connectionStatus: input.connectionStatus } : {}),
        ...(input.connectedAt ? { connectedAt: input.connectedAt } : {}),
        metadata: {
          ...accMeta,
          ...(finalAvatar ? { avatar: finalAvatar } : {}),
          lastVerifiedAt: nowIso,
          identitySnapshot: {
            externalAccountId: finalExternalId,
            accountName: finalName,
            avatar: finalAvatar,
            checkedAt: nowIso,
            via: input.via,
          },
        },
      },
    })
  }

  /** 设置账号权限等级（1/2/3），仅允许升级到掌柜批准的范围（当前冻结 L1，L2/L3 预留） */
  async setPermissionLevel(accountId: string, level: number) {
    if (![1, 2, 3].includes(level)) throw new Error('权限等级必须为 1/2/3')
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    await prisma.enterpriseChannelAccount.update({
      where: { id: accountId },
      data: { metadata: { ...((account.metadata as any) || {}), permissionLevel: level } },
    })
    return { accountId, permissionLevel: level }
  }

  /** 权限 Gate：校验账号等级是否满足操作所需最低等级（不满足抛 permission_denied） */
  async requirePermissionLevel(accountId: string, operation: string) {
    const required = this.PERMISSION_MATRIX[operation]
    if (required === undefined) {
      const err: any = new Error(`未知操作: ${operation}`)
      err.code = 'permission_denied'
      throw err
    }
    const level = await this.getPermissionLevel(accountId)
    if (level < required) {
      const err: any = new Error(
        `当前为 L${level} 权限（${this.levelLabel(level)}），操作 ${operation} 需要 L${required}（${this.levelLabel(required)}）。升级权限请联系掌柜。`,
      )
      err.code = 'permission_denied'
      throw err
    }
    return { level, required }
  }

  private levelLabel(level: number): string {
    return level === 1 ? '观察员工' : level === 2 ? '运营助理' : '运营经理'
  }

  /**
   * 连接渠道账号
   *
   * SPRINT-MEDIA-CHANNEL-01 Task02 — 凭证层冻结修复：
   * - 修复前：credential 明文 JSON 落库（security TODO），且字段名与模型不匹配（platform/encryptedCred/status 不存在）
   * - 修复后：AES-256-GCM 加密（crypto.service encryptKey，格式 iv:tag:ciphertext）写入 credentialEncrypted
   * - 规则：never plaintext / never frontend exposed（解密仅服务端适配器内部使用）
   */
  async connectAccount(input: {
    tenantId: string
    organizationId?: string
    platform: string
    accountName: string
    externalAccountId?: string
    credential: Record<string, string>
    // SPRINT-MEDIA-TENANT-ISOLATION-FIX-02 — 用户私有资产模型：创建者即 owner（禁止空 ownerId）
    ownerId?: string
  }) {
    const encryptedCred = encryptKey(JSON.stringify(input.credential))
    return prisma.enterpriseChannelAccount.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        organizationId: input.organizationId ?? null,
        channelType: input.platform,
        channelName: input.accountName,
        externalAccountId: input.externalAccountId ?? null,
        credentialEncrypted: { cipher: 'aes-256-gcm', payload: encryptedCred } as any,
        connectionStatus: ChannelConnectionStatus.PENDING,
        connectedAt: null,
        ownerId: input.ownerId ?? '',
        ownerType: 'gov_user',
      },
    })
  }

  /**
   * 解密渠道凭证（仅服务端适配器/运行时内部调用，禁止暴露到前端）
   */
  async getCredential(accountId: string): Promise<Record<string, string>> {
    const account = await prisma.enterpriseChannelAccount.findUnique({
      where: { id: accountId },
      select: { credentialEncrypted: true },
    })
    if (!account) throw new Error('Channel account not found')
    const enc = (account.credentialEncrypted as any)?.payload
    if (!enc) throw new Error('Channel credential is empty')
    return JSON.parse(decryptKey(enc))
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.4 — 凭证续期回写（仅 Runtime 适配器内部调用）
   * adapter 不落库：refreshCredential 取到新 cookie 后经此方法加密写回 credentialEncrypted
   */
  async updateCredential(accountId: string, credential: Record<string, string>): Promise<void> {
    const encryptedCred = encryptKey(JSON.stringify(credential))
    await prisma.enterpriseChannelAccount.update({
      where: { id: accountId },
      data: {
        credentialEncrypted: { cipher: 'aes-256-gcm', payload: encryptedCred } as any,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — Enterprise Channel Runtime 编排：连接渠道
   * 企业渠道账号 → resolveAdapter(channelType) → adapter.connect（浏览器自动化登录）
   * TASK03.2.2 — 人工授权确认事件：
   *   探针检测到登录态 ≠ 自动 connected。首次登录需用户点「确认绑定」（SaaS 授权确认事件）；
   *   已确认过的账号（connectionStatus=connected + externalAccountId）→ 维持登录直接 connected（G2）
   */
  async connectChannel(accountId: string) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)

    // TASK03.1.5 — 记录运行环境（ChannelBrowserSession，账号身份与运行环境分离）
    const profilePath = browserRuntime.getProfilePath(account.channelType, account.id)
    const session = await channelBrowserSessionService.getOrCreate(account.id, {
      browserType: 'chromium',
      profilePath,
    })
    await channelBrowserSessionService.markStarted(session.id)

    // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 03 — BrowserAuthSession 状态机：INIT → OPEN_BROWSER
    try {
      const { browserAuthSessionService } = await import('./browser-auth-session.service.js')
      const authSession = await browserAuthSessionService.begin(account.id, { type: 'app' })
      await browserAuthSessionService.transition(authSession.id, 'OPEN_BROWSER').catch(async (e: any) => {
        console.warn(`[ChannelService] 授权状态机 OPEN_BROWSER 降级: ${e.message}`)
        await browserAuthSessionService.mark(authSession.id, 'OPEN_BROWSER')
      })
    } catch (e: any) {
      console.warn(`[ChannelService] 授权流程开启失败: ${e.message}`)
    }

    const result = await adapter.connect(account.id)
    if (result.status === 'connected') {
      // 已确认账号（曾绑定）→ 维持登录态直接 connected；首次 → 需人工确认绑定
      const alreadyBound = isChannelConnected(account.connectionStatus) && !!account.externalAccountId
      if (alreadyBound) {
        // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 03 — 状态机：AUTH_SUCCESS（已授权环境恢复登录态）
        try {
          const { browserAuthSessionService } = await import('./browser-auth-session.service.js')
          const authSession = await browserAuthSessionService.begin(account.id, { type: 'app' })
          await browserAuthSessionService.mark(authSession.id, 'AUTH_SUCCESS', {
            verifiedIdentity: {
              accountName: result.accountName ?? account.channelName,
              externalAccountId: result.externalAccountId ?? account.externalAccountId,
            },
            metadata: { restored: true },
          })
        } catch (e: any) {
          console.warn(`[ChannelService] 授权状态机恢复标记失败: ${e.message}`)
        }
        // TASK03.2.1 — 回写最新身份（登录态维持，身份可能更新）
        // IDENTITY-VIEW-01 — 统一走 SSOT 写入入口（externalAccountId + accountName + avatarUrl）
        await this.updateChannelIdentity(account.id, {
          externalAccountId: result.externalAccountId ?? account.externalAccountId,
          accountName: result.accountName ?? account.accountName ?? account.channelName,
          avatarUrl: result.avatar ?? account.avatarUrl ?? (account.metadata as any)?.avatar ?? null,
          via: 'connect_keepalive',
          connectionStatus: ChannelConnectionStatus.CONNECTED,
          connectedAt: account.connectedAt ?? new Date(),
        })
        await channelBrowserSessionService.markHealthCheck(session.id, { loginState: 'connected' })
        return { ...result, status: 'connected' }
      }
      // 首次登录 → 等待用户人工确认绑定（不写 DB，探针身份暂存返回）
      return {
        ...result,
        status: 'awaiting_confirmation',
        // KUAISHOU-FIX-01 — 文案平台泛化（原来写死「抖音」，快手/小红书会误导）
        message: result.accountName
          ? `已检测到「${result.accountName}」账号登录，请确认绑定后完成连接`
          : '已检测到平台账号登录，请确认绑定后完成连接',
      }
    } else if (result.status === 'waiting_login') {
      // SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase E — 登录态失效：connected → expired（不得一直显示在线）
      if (isChannelConnected(account.connectionStatus)) {
        await prisma.enterpriseChannelAccount.update({
          where: { id: account.id },
          data: { connectionStatus: ChannelConnectionStatus.EXPIRED },
        })
      } else if (account.connectionStatus === ChannelConnectionStatus.PENDING) {
        // REALITY-HARDENING-01 Task02 — 浏览器已打开等扫码：PENDING → WAITING_LOGIN
        await prisma.enterpriseChannelAccount.update({
          where: { id: account.id },
          data: { connectionStatus: ChannelConnectionStatus.WAITING_LOGIN },
        })
      }
    }
    return result
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase A — 等待扫码登录完成（大脑层编排）
   * adapter.waitForLogin 轮询登录态（不刷新页面）
   * TASK03.2.2 — 登录成功但未确认 → 返回 awaiting_confirmation（等用户确认绑定）
   */
  async waitChannelLogin(accountId: string, timeoutMs?: number) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)
    if (!adapter.waitForLogin) {
      throw new Error('当前渠道不支持等待登录流程')
    }
    const result = await adapter.waitForLogin(account.id, timeoutMs)
    if (result.status === 'connected') {
      // ═══ LOGIN-REALITY-FIX-01 Task01 — 身份闭环：探针成功 ≠ 连接成功 ═══
      // 掌柜冻结模型：probe.loginSuccess → extractIdentity → updateChannelIdentity
      //              → externalAccountId 非空才允许 CONNECTED → return success
      // 任何一步失败：返回明确状态（AUTHENTICATED / IDENTITY_VERIFIED），绝不假装连接。
      const sid = adapter.sessionIdFor ? adapter.sessionIdFor(account.id) : `${account.channelType}:${account.id}`

      // 1) 身份提取：优先用探针结果；缺失时主动复核一次
      let identity: {
        accountId: string | null | undefined
        accountName: string | null | undefined
        avatar: string | null | undefined
        permissions?: string[]
      } = {
        accountId: result.externalAccountId,
        accountName: result.accountName,
        avatar: result.avatar,
        permissions: result.permissions,
      }
      if (!identity.accountId) {
        const probe = identityProbeRegistry.get(account.channelType)
        if (probe) {
          try {
            const p = await probe.probe(sid)
            if (p.authenticated) {
              identity = {
                accountId: p.accountId,
                accountName: p.accountName,
                avatar: p.avatar,
                permissions: p.permissions,
              }
            }
          } catch (e: any) {
            console.warn(`[ChannelService] waitChannelLogin 探针复核异常: ${e.message}`)
          }
        }
      }

      // 2) 身份必须完整：externalAccountId 非空才允许推进（掌柜：身份才是连接证明）
      if (!identity.accountId) {
        return {
          ...result,
          status: 'AUTHENTICATED',
          message: '登录成功，但账号身份确认失败（未提取到账号 ID），请重新扫码或手动确认绑定',
        }
      }

      // 3) 身份锚定 → IDENTITY_VERIFIED（SSOT 写入：externalAccountId + accountName + avatarUrl）
      await this.updateChannelIdentity(account.id, {
        externalAccountId: identity.accountId,
        accountName: identity.accountName ?? account.accountName ?? account.channelName,
        avatarUrl: identity.avatar ?? account.avatarUrl ?? (account.metadata as any)?.avatar ?? null,
        via: 'wait_login_identity',
        connectionStatus: ChannelConnectionStatus.IDENTITY_VERIFIED,
        connectedAt: account.connectedAt ?? new Date(),
      })

      // 4) 凭证落库（adapter 内部探针复核 + cookie 加密保存）→ 成功才 CONNECTED
      try {
        const cred = await adapter.refreshCredential(account.id)
        if (!cred.ok) {
          // 身份已锚定但凭证保存失败：不假装连接，返回明确中间态
          return {
            ...result,
            status: 'IDENTITY_VERIFIED',
            accountName: identity.accountName ?? account.channelName,
            externalAccountId: identity.accountId,
            message: `账号身份已确认，但登录凭证保存失败：${cred.error || '未知错误'}，请确认绑定重试`,
          }
        }
        await prisma.enterpriseChannelAccount.update({
          where: { id: account.id },
          data: { connectionStatus: ChannelConnectionStatus.CONNECTED, connectedAt: account.connectedAt ?? new Date() },
        })
      } catch (e: any) {
        return {
          ...result,
          status: 'IDENTITY_VERIFIED',
          accountName: identity.accountName ?? account.channelName,
          externalAccountId: identity.accountId,
          message: `账号身份已确认，但登录凭证保存异常：${e.message}，请确认绑定重试`,
        }
      }

      // 5) 会话健康记录（仅全闭环成功）
      try {
        const session = await channelBrowserSessionService.findByAccount(account.id)
        if (session) {
          await channelBrowserSessionService.markHealthCheck(session.id, { loginState: 'connected' })
        }
      } catch (e: any) {
        console.warn(`[ChannelService] 浏览器会话健康检查记录失败: ${e.message}`)
      }
      return {
        ...result,
        status: 'connected',
        accountName: identity.accountName ?? account.channelName,
        externalAccountId: identity.accountId,
      }
    }
    if (result.status === 'awaiting_confirmation') {
      // REALITY-HARDENING-01 Task02 — 扫码完成待确认：WAITING_LOGIN → VERIFYING
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: { connectionStatus: ChannelConnectionStatus.VERIFYING },
      }).catch((e: any) => console.warn(`[ChannelService] VERIFYING 状态更新失败: ${e.message}`))
    }
    return result
  }

  /**
   * TASK03.2.2 — 人工授权确认事件（SaaS 产品关键：不猜，用户点「确认绑定」）
   * 流程：扫码成功 → 系统检测 → 显示账号身份 → 用户点确认 → 本方法执行：
   *   1. 探针复核（登录态仍在）
   *   2. 回写 EnterpriseChannelAccount（connected + externalAccountId + channelName + avatar）
   *   3. 保存 cookie 凭证（AES 加密落库）
   *   4. 记录浏览器会话健康
   *   5. 默认权限 Level 1（观察员工：读取/分析）——L2/L3 后续掌柜批准后开放
   */
  async confirmChannelBinding(accountId: string) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)
    const sid = adapter.sessionIdFor ? adapter.sessionIdFor(account.id) : `${account.channelType}:${account.id}`

    // LOGIN-REALITY-FIX-01 — 确认绑定前确保实例存在（restart 后 Map 丢失时从 profile 重建）：
    // ⚠️ 不 navigate 回 loginUrl：视频号无 cookie 自动恢复（依赖本机微信 fastLogin），
    //    强制导航只会把已登录的工作台现场导航回登录页；登录态由探针判定，miss 则明确提示重新扫码。
    try {
      const profilePath = browserRuntime.getProfilePath(account.channelType, account.id)
      await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: false })
      // WECHAT-CHANNELS-FIX-01 — 重启后浏览器新起默认 about:blank，探针看不到工作台 → confirm 必 400：
      // 实例就绪后若当前页面不在工作台（about:blank/登录页），导航到 workspaceUrl（非 loginUrl）——
      // cookie 持久化有效则直接进工作台（实测 wxuin/sessionid 够用），无效才跳登录页（探针 miss 合理）
      const meta = CHANNEL_META[account.channelType as keyof typeof CHANNEL_META] as any
      const wsUrl = meta?.workspaceUrl
      if (wsUrl) {
        await browserRuntime.withPage(sid, async (page: any) => {
          const url = page.url()
          const onWorkspace = (meta.identityRules?.urlFragments || []).some((f: string) => url.includes(f))
          if (!onWorkspace && (url === 'about:blank' || /\/login|login\.html|passport/i.test(url))) {
            await page.goto(wsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
            await page.waitForTimeout(2000 + Math.random() * 1500)
          }
        })
      }
    } catch (e: any) {
      console.warn(`[ChannelService] confirmBinding 实例恢复异常（继续探针）: ${e.message}`)
    }

    // 1. 探针复核：登录态是否仍在 + 身份完整
    const probe = identityProbeRegistry.get(account.channelType)
    if (!probe) throw new Error(`渠道 ${account.channelType} 无身份探针`)
    let identity = await probe.probe(sid)
    // LOGIN-REALITY-FIX-01 — 登录跳转竞态容错：
    // 视频号扫码成功后需手机确认 → 页面才从 login.html 跳转工作台（1~5s）
    // 掌柜点「确认绑定」时页面可能还在跳转中 → 探针误判未登录 → 400
    // 修复：首次 miss 后退避重试（2s/4s/6s），页面跳转完成后即可命中，不再把竞态抛给用户
    if (!identity.authenticated) {
      for (let i = 1; i <= 3; i++) {
        await new Promise(r => setTimeout(r, 2000 * i))
        console.warn(`[ChannelService] confirmBinding 探针复核重试 ${i}/3（${account.channelType} 页面跳转中）`)
        identity = await probe.probe(sid)
        if (identity.authenticated) break
      }
    }
    if (!identity.authenticated) {
      throw new Error('未检测到有效登录态，请重新扫码登录')
    }

    // 2. 回写账号身份（G1：externalAccountId + accountName + avatarUrl）
    // IDENTITY-VIEW-01 — 统一走 SSOT 写入入口（身份锚点落 SSOT 列，metadata 只存新鲜度/权限）
    // LOGIN-REALITY-FIX-01 Task03 — 掌柜冻结模型：AUTHENTICATED（浏览器登录）→ IDENTITY_VERIFIED（身份锚定）→ CONNECTED（凭证落库）
    //   身份是连接证明：externalAccountId 非空才允许推进（绝不写 NULL 身份冒充连接）
    const finalExternalId = identity.accountId ?? account.externalAccountId
    if (!finalExternalId) {
      const err: any = new Error('登录成功，但账号身份确认失败（未提取到账号 ID），请重新扫码')
      err.code = 'identity_missing'
      throw err
    }
    // LOGIN-REALITY-FIX-01 — 假 ID 防护：ensure-account 占位符（platform-时间戳）不是真实身份，
    // 探针未提取到真实 ID 时禁止 fallback 保留假 ID（掌柜：身份是连接证明，假 ID 等于未绑定）
    if (!identity.accountId && /^[a-z_]+-\d{10,}$/.test(finalExternalId)) {
      const err: any = new Error('登录成功，但未提取到真实账号 ID（当前为占位身份），请重新扫码或稍后重试')
      err.code = 'identity_missing'
      throw err
    }
    await this.updateChannelIdentity(account.id, {
      externalAccountId: finalExternalId,
      accountName: identity.accountName ?? account.accountName ?? account.channelName,
      avatarUrl: identity.avatar ?? account.avatarUrl ?? (account.metadata as any)?.avatar ?? null,
      via: 'confirm_binding',
      connectionStatus: ChannelConnectionStatus.IDENTITY_VERIFIED,
      connectedAt: new Date(),
    })
    // 权限/绑定元数据单独维护（非身份数据）
    await prisma.enterpriseChannelAccount.update({
      where: { id: account.id },
      data: {
        metadata: {
          ...((account.metadata as any) || {}),
          permissionLevel: (account.metadata as any)?.permissionLevel ?? 1, // L1 观察员工（默认）
          permissions: identity.permissions,
          boundAt: new Date().toISOString(),
          // Channel Identity Trust Completion — 设备可信标记：本次绑定完成即建立长期可信环境，
          // 后续同一 profile 恢复登录态时不再触发新设备风控（由平台侧 profile 连续性保证）
          deviceTrusted: true,
        },
      },
    })

    // 2.5 ChannelVerificationSession — 授权设备验证完成记录（用户主动完成平台安全验证后固化）
    // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 03 — BrowserAuthSession 状态机：AUTH_SUCCESS
    try {
      const { browserAuthSessionService } = await import('./browser-auth-session.service.js')
      // 开启（或复用进行中）授权流程
      const authSession = await browserAuthSessionService.begin(account.id, { type: 'app' })
      // PLATFORM_VERIFY → AUTH_SUCCESS（扫码 + 平台验证 + 探针确认后由用户确认绑定 = 授权成功）
      await browserAuthSessionService
        .transition(authSession.id, 'AUTH_SUCCESS', {
          verifiedIdentity: {
            accountName: identity.accountName ?? account.channelName,
            externalAccountId: identity.accountId ?? account.externalAccountId,
            avatar: identity.avatar ?? null,
          },
          metadata: {
            boundVia: 'scan_confirm',
            permissionLevel: 1,
            authStage: 'AUTH_SUCCESS',
          },
        })
        .catch(async (e: any) => {
          // 非法迁移（如已是 AUTH_SUCCESS）→ 直接快进标记，不报错
          console.warn(`[ChannelService] 授权状态机迁移降级（${e.message}），直接标记 AUTH_SUCCESS`)
          await browserAuthSessionService.mark(authSession.id, 'AUTH_SUCCESS', {
            verifiedIdentity: {
              accountName: identity.accountName ?? account.channelName,
              externalAccountId: identity.accountId ?? account.externalAccountId,
              avatar: identity.avatar ?? null,
            },
          })
        })
    } catch (e: any) {
      console.warn(`[ChannelService] 验证会话记录失败: ${e.message}`)
    }

    // 3. 保存 cookie 凭证（登录成功即续期落库）
    // LOGIN-REALITY-FIX-01 Task03 — 凭证不是连接证明，身份才是：
    //   身份已锚定（IDENTITY_VERIFIED），凭证落库成功才 CONNECTED；失败必须显式返回失败，绝不假装连接
    try {
      const result = await adapter.refreshCredential(account.id)
      if (!result.ok) {
        const err: any = new Error(`账号身份已确认，但登录凭证保存失败：${result.error || '未知错误'}，请重试`)
        err.code = 'credential_failed'
        throw err
      }
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: { connectionStatus: ChannelConnectionStatus.CONNECTED },
      })
    } catch (e: any) {
      if (e.code === 'credential_failed') throw e
      const err: any = new Error(`账号身份已确认，但登录凭证保存异常：${e.message}`)
      err.code = 'credential_failed'
      throw err
    }

    // 4. 浏览器会话健康记录
    try {
      const session = await channelBrowserSessionService.findByAccount(account.id)
      if (session) {
        await channelBrowserSessionService.markHealthCheck(session.id, {
          loginState: 'connected',
          confirmedAt: new Date().toISOString(),
        })
      }
    } catch (e: any) {
      console.warn(`[ChannelService] 浏览器会话健康检查记录失败: ${e.message}`)
    }

    // 5. SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 — 登录成功即确保数字电脑（BrowserWorkspace）存在
    //    闭环：确认绑定（CONNECTED）→ 自动建 workspace（同一 profile）→ 启动恢复/owner-view 可发现
    //    幂等：已存在则复用；失败不阻断绑定结果
    try {
      const { browserWorkspaceService } = await import('./browser-workspace.service.js')
      await browserWorkspaceService.getOrCreate(
        account.tenantId,
        account.organizationId || account.tenantId || 'default',
        account.id,
        'media',
      )
      console.log(`[ChannelService] ✅ 确认绑定后数字电脑就绪: ${account.id}`)
    } catch (e: any) {
      console.warn(`[ChannelService] 数字电脑创建失败（不影响绑定）: ${e.message}`)
    }

    return {
      status: 'connected',
      accountName: identity.accountName ?? account.channelName,
      externalAccountId: identity.accountId ?? account.externalAccountId,
      avatar: identity.avatar,
      permissions: identity.permissions,
      permissionLevel: 1,
    }
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — Enterprise Channel Runtime 编排：读取真实指标
   * 企业渠道账号 → resolveAdapter → adapter.fetchMetrics（粉丝/作品/获赞，禁止 mock）
   * Task03.2 Phase D — 支持 AI 员工上下文：传入 agentInstanceId 时先做权限校验（analyze/read）
   */
  async fetchMetrics(accountId: string, opts?: { agentInstanceId?: string }): Promise<ChannelMetrics> {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    if (opts?.agentInstanceId) {
      await this.authorizeAgentAction(opts.agentInstanceId, accountId, 'analyze')
    }
    // TASK03.2.2 — 三级权限 Gate：读取指标需要 L1（观察员工）
    await this.requirePermissionLevel(accountId, 'read:metrics')
    const adapter = this.resolveAdapter(account.channelType)
    return adapter.fetchMetrics(account.id)
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — Enterprise Channel Runtime 编排：凭证续期
   * REALITY-HARDENING-01 Task01 — Reality Gate：未登录/无身份账号不得进入 connected
   * 流程：探针复核（authenticated + accountId）→ adapter.refreshCredential（内部同样探针校验）→ CONNECTED
   */
  async refreshChannelCredential(accountId: string) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)

    // REALITY-HARDENING-01 Task01 — Reality Gate 第一层：探针复核，未登录直接拒绝
    const probe = identityProbeRegistry.get(account.channelType)
    if (!probe) throw new Error(`渠道 ${account.channelType} 无身份探针`)
    const sid = adapter.sessionIdFor ? adapter.sessionIdFor(account.id) : `${account.channelType}:${account.id}`
    let identity: Awaited<ReturnType<typeof probe.probe>> | null = null
    try {
      identity = await probe.probe(sid)
    } catch (e: any) {
      const err: any = new Error(`登录态探针失败，拒绝刷新凭证: ${e.message}`)
      err.code = 'auth_required'
      throw err
    }
    if (!identity.authenticated || !identity.accountId) {
      const err: any = new Error('未检测到有效登录态（无真实账号身份），拒绝刷新凭证')
      err.code = 'auth_required'
      throw err
    }

    // Reality Gate 第二层：adapter 内部同样校验（防绕过）
    const result = await adapter.refreshCredential(account.id)
    if (!result.ok) {
      return result
    }
    // 探针确认真人 + 凭证落库成功 → CONNECTED（身份 + 凭证 + runtime 全部正常）
    // IDENTITY-VIEW-01 — 统一走 SSOT 写入入口（externalAccountId + accountName + avatarUrl）
    await this.updateChannelIdentity(account.id, {
      externalAccountId: identity.accountId ?? account.externalAccountId,
      accountName: identity.accountName ?? account.accountName ?? account.channelName,
      avatarUrl: identity.avatar ?? account.avatarUrl ?? (account.metadata as any)?.avatar ?? null,
      via: 'refresh_credential',
      connectionStatus: ChannelConnectionStatus.CONNECTED,
      connectedAt: new Date(),
    })
    return result
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — Enterprise Channel Runtime 编排：健康检查
   */
  async getChannelHealth(accountId: string): Promise<ChannelHealth> {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)
    return adapter.healthCheck()
  }

  /**
   * TASK03.2.2 — Runtime Health Agent（渠道运行健康三态）
   * 掌柜蓝图：老板看到「我的 AI 员工办公室正常」，不是「cookie 有没有」
   *
   * {
   *   browser:  'online' | 'offline' | 'degraded'   — Chromium 实例存活
   *   session:  'valid' | 'invalid' | 'unknown'     — 持久化 profile 存在 + 最近健康检查
   *   account:  'connected' | 'expired' | 'none'    — DB 账号绑定状态
   *   permission: 'read/analyze' (L1)               — 当前授权等级
   *   lastCheck: '3分钟前'                           — 最近健康检查
   * }
   */
  async getRuntimeHealth(accountId: string) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')

    // account 态：DB 绑定状态（G3 验收核心）
    // REALITY-HARDENING-01 — 仅 CONNECTED + externalAccountId 才是可信在线；
    // WAITING_LOGIN/VERIFYING/AUTHENTICATED/IDENTITY_VERIFIED → connecting（流程中，绝不显示已连接）
    const accountState = (() => {
      if (isChannelConnected(account.connectionStatus) && account.externalAccountId) return 'connected'
      if (account.connectionStatus === ChannelConnectionStatus.EXPIRED) return 'expired'
      if ([
        ChannelConnectionStatus.WAITING_LOGIN,
        ChannelConnectionStatus.VERIFYING,
        ChannelConnectionStatus.AUTHENTICATED,
        ChannelConnectionStatus.IDENTITY_VERIFIED,
      ].includes(account.connectionStatus as any)) return 'connecting'
      return 'none'
    })()

    // browser 态：浏览器实例是否存活（内存态）+ Chromium 可启动性兜底
    let browserState: 'online' | 'offline' | 'degraded' = 'offline'
    const sid = this.adapterSessionId(account)
    try {
      const instances = browserRuntime.listInstances()
      const inst = instances.find(i => i.sessionId === sid)
      if (inst) {
        browserState = 'online'
      } else {
        // 无活跃实例但 profile 存在 → degraded（可启动但未运行，按需拉起）
        const fs = await import('fs')
        const profilePath = browserRuntime.getProfilePath(account.channelType, account.id)
        browserState = fs.existsSync(profilePath) ? 'degraded' : 'offline'
      }
    } catch (e: any) {
      console.warn(`[RuntimeHealth] 浏览器状态探测异常: ${e.message}`)
    }

    // session 态：持久化 profile 存在 + 最近健康检查时间
    let sessionState: 'valid' | 'invalid' | 'degraded' | 'unknown' = 'unknown'
    let lastHealthAt: Date | null = null
    try {
      const session = await channelBrowserSessionService.findByAccount(account.id)
      if (session) {
        lastHealthAt = session.lastHealthCheckAt
        const fs = await import('fs')
        const profileExists = fs.existsSync(session.profilePath)
        const fresh = session.lastHealthCheckAt && (Date.now() - session.lastHealthCheckAt.getTime()) < 7 * 24 * 3600 * 1000
        sessionState = profileExists && fresh ? 'valid' : profileExists ? 'degraded' : 'unknown'
      }
    } catch (e: any) {
      console.warn(`[RuntimeHealth] 会话状态探测异常: ${e.message}`)
    }

    // permission：当前授权等级（默认 L1 观察员工）
    const permissionLevel = (account.metadata as any)?.permissionLevel ?? 1
    const permissionLabel = permissionLevel === 1 ? 'read/analyze' : permissionLevel === 2 ? 'read/write (需批准)' : 'read/write/publish (明确授权)'

    // Channel Identity Trust Completion — 安全验证状态（首次绑定新设备风控已完成 → 长期可信）
    let verification: { status: string; type: string; completedAt: string | null; accountName: string | null } | null = null
    try {
      const latest = await prisma.channelVerificationSession.findFirst({
        where: { channelAccountId: account.id, status: 'VERIFIED' },
        orderBy: { completedAt: 'desc' },
      })
      if (latest) {
        verification = {
          status: latest.status,
          type: latest.verificationType,
          completedAt: latest.completedAt ? latest.completedAt.toISOString() : null,
          accountName: (latest.verifiedIdentity as any)?.accountName ?? null,
        }
      }
    } catch (e: any) {
      console.warn(`[RuntimeHealth] 验证状态查询异常: ${e.message}`)
    }

    return {
      browser: browserState,
      session: sessionState,
      account: accountState,
      permission: permissionLabel,
      permissionLevel,
      accountName: account.channelName,
      lastCheck: lastHealthAt ? this.relativeTime(lastHealthAt) : '从未检查',
      lastCheckAt: lastHealthAt ? lastHealthAt.toISOString() : null,
      // Channel Identity Trust Completion — 安全验证完成状态（无需重复验证，直接恢复）
      verification: verification
        ? { ...verification, label: `安全验证已完成（${verification.type === 'sms' ? '短信验证' : verification.type === 'face' ? '刷脸验证' : 'App确认'}）` }
        : { status: 'none', type: 'none', completedAt: null, accountName: null, label: '尚未完成首次安全验证' },
      deviceTrusted: !!(account.metadata as any)?.deviceTrusted,
      checkedAt: new Date().toISOString(),
    }
  }

  /** 统一会话 ID（adapter 有 sessionIdFor 用之，否则默认） */
  private adapterSessionId(account: { channelType: string; id: string }): string {
    const adapter = this.resolveAdapter(account.channelType)
    if (adapter.sessionIdFor) return adapter.sessionIdFor(account.id)
    return `${account.channelType}:${account.id}`
  }

  /** 相对时间（人类可读） */
  private relativeTime(d: Date): string {
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    return `${Math.floor(hours / 24)}天前`
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase D — 发布（权限层放行后进入 adapter 执行层）
   * adapter.publish 在 Task 03 阶段仍硬编码禁用（掌柜暂时禁止事项：❌ 自动发布），
   * 权限放行 ≠ 开放发布；本方法验证的是 AgentChannelBinding 权限隔离链路
   */
  async publishWithPermission(accountId: string, content: ChannelContent, opts?: { agentInstanceId?: string }): Promise<PublishResult> {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    if (opts?.agentInstanceId) {
      await this.authorizeAgentAction(opts.agentInstanceId, accountId, 'publish')
    }
    // TASK03.2.2 — 三级权限 Gate：发布需要 L3（运营经理，明确授权）
    await this.requirePermissionLevel(accountId, 'publish')
    const adapter = this.resolveAdapter(account.channelType)
    return adapter.publish(content)
  }

  /**
   * 获取企业所有渠道账号
   */
  async getAccounts(tenantId: string) {
    return prisma.enterpriseChannelAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** 获取单个渠道账号（含 metadata） */
  async getAccountById(accountId: string) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    return account
  }

  /**
   * 创建内容（草稿）
   */
  async createContent(input: {
    tenantId: string
    agentId: string
    channelAccountId: string
    platform: string
    title: string
    body: string
    images?: string[]
  }) {
    return prisma.enterpriseContentPublish.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        agentId: input.agentId,
        channelAccountId: input.channelAccountId,
        title: input.title,
        body: input.body,
        images: JSON.stringify(input.images || []),
        platform: input.platform,
        status: ContentStatus.DRAFT,
      },
    })
  }

  /**
   * 提交AI审核
   */
  async submitForReview(contentId: string) {
    return prisma.enterpriseContentPublish.update({
      where: { id: contentId },
      data: { status: ContentStatus.AI_REVIEW },
    })
  }

  /**
   * AI审核通过，等待人工审批
   */
  async aiReviewPassed(contentId: string) {
    return prisma.enterpriseContentPublish.update({
      where: { id: contentId },
      data: { status: ContentStatus.WAIT_APPROVAL },
    })
  }

  /**
   * 人工审批通过
   */
  async approve(contentId: string) {
    return prisma.enterpriseContentPublish.update({
      where: { id: contentId },
      data: { status: ContentStatus.APPROVED },
    })
  }

  /**
   * 拒绝
   */
  async reject(contentId: string, reason: string) {
    return prisma.enterpriseContentPublish.update({
      where: { id: contentId },
      data: { status: ContentStatus.REJECTED, rejectionReason: reason },
    })
  }

  /**
   * 发布内容（直接发布已审批内容）
   */
  async publish(contentId: string): Promise<PublishResult> {
    const content = await prisma.enterpriseContentPublish.findUnique({ where: { id: contentId } })
    if (!content) return { publishId: '', publishedAt: new Date(), status: 'failed', error: '内容不存在' }

    const adapter = this.adapters.get(content.platform)
    if (!adapter) return { publishId: contentId, publishedAt: new Date(), status: 'failed', error: `渠道 ${content.platform} 未注册` }

    try {
      const result = await adapter.publish({
        title: content.title,
        body: content.body,
        images: JSON.parse(content.images || '[]'),
      })

      // 更新发布状态
      await prisma.enterpriseContentPublish.update({
        where: { id: contentId },
        data: {
          status: result.status === 'success' ? ContentStatus.PUBLISHED : ContentStatus.REJECTED,
          publishTime: result.publishedAt,
          platformPostId: result.platformPostId,
          platformUrl: result.url,
        },
      })

      return result
    } catch (e: any) {
      return { publishId: contentId, publishedAt: new Date(), status: 'failed', error: e.message }
    }
  }

  /**
   * 拉取互动
   */
  async fetchInteractions(tenantId: string, since?: Date): Promise<PlatformInteraction[]> {
    const adapter = this.adapters.get('mock') // TODO: 使用实际适配器
    if (!adapter) return []
    return adapter.fetchInteractions(since)
  }

  /**
   * 获取企业内容列表
   */
  async getContentList(tenantId: string, status?: string, platform?: string) {
    const where: any = { tenantId }
    if (status) where.status = status
    if (platform) where.platform = platform
    return prisma.enterpriseContentPublish.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  /**
   * 记录用户互动
   */
  async recordInteraction(input: {
    tenantId: string
    channelAccountId: string
    contentPublishId?: string
    platformUserId: string
    platform: string
    type: string
    content: string
    intentScore?: number
    leadStatus?: string
  }) {
    return prisma.enterpriseInteraction.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        channelAccountId: input.channelAccountId,
        contentPublishId: input.contentPublishId,
        platformUserId: input.platformUserId,
        platform: input.platform,
        type: input.type,
        content: input.content,
        intentScore: input.intentScore || 0,
        leadStatus: input.leadStatus || 'cold',
      },
    })
  }

  /**
   * 获取互动列表
   */
  async getInteractions(tenantId: string, type?: string, leadStatus?: string) {
    const where: any = { tenantId }
    if (type) where.type = type
    if (leadStatus) where.leadStatus = leadStatus
    return prisma.enterpriseInteraction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  /**
   * 回复用户
   */
  async replyToInteraction(interactionId: string, replyContent: string) {
    return prisma.enterpriseInteraction.update({
      where: { id: interactionId },
      data: { replied: true, replyContent, repliedAt: new Date() },
    })
  }

  /**
   * 获取发布漏斗数据（用于Growth Dashboard）
   */
  async getGrowthFunnel(tenantId: string, startDate?: Date, endDate?: Date) {
    const publishWhere: any = { tenantId, status: ContentStatus.PUBLISHED }
    if (startDate) publishWhere.publishTime = { gte: startDate }
    if (endDate) publishWhere.publishTime = { ...publishWhere.publishTime, lte: endDate }

    const [totalPublished, totalInteractions, totalComments, totalMessages, leads, hotLeads] = await Promise.all([
      prisma.enterpriseContentPublish.count({ where: publishWhere }),
      prisma.enterpriseInteraction.count({ where: { tenantId } }),
      prisma.enterpriseInteraction.count({ where: { tenantId, type: 'comment' } }),
      prisma.enterpriseInteraction.count({ where: { tenantId, type: 'message' } }),
      prisma.enterpriseInteraction.count({ where: { tenantId, leadStatus: { in: ['warm', 'hot', 'customer'] } } }),
      prisma.enterpriseInteraction.count({ where: { tenantId, leadStatus: 'hot' } }),
    ])

    return {
      totalPublished,
      totalInteractions,
      totalComments,
      totalMessages,
      leads,
      hotLeads,
      conversionRate: totalInteractions > 0 ? (leads / totalInteractions * 100).toFixed(1) : '0.0',
    }
  }
}

export const channelService = new ChannelService()
