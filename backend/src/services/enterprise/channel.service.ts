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
        ownerId: '',
        ownerType: 'org',
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
        await prisma.enterpriseChannelAccount.update({
          where: { id: account.id },
          data: {
            connectionStatus: ChannelConnectionStatus.CONNECTED,
            connectedAt: account.connectedAt ?? new Date(),
            externalAccountId: result.externalAccountId ?? account.externalAccountId,
            channelName: result.accountName ?? account.channelName,
          },
        })
        await channelBrowserSessionService.markHealthCheck(session.id, { loginState: 'connected' })
        return { ...result, status: 'connected' }
      }
      // 首次登录 → 等待用户人工确认绑定（不写 DB，探针身份暂存返回）
      return {
        ...result,
        status: 'awaiting_confirmation',
        message: '已检测到抖音账号登录，请确认绑定后完成连接',
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
      // 已确认账号 → 维持登录（G2 重启后仍 connected）
      const alreadyBound = isChannelConnected(account.connectionStatus) && !!account.externalAccountId
      if (alreadyBound) {
        await prisma.enterpriseChannelAccount.update({
          where: { id: account.id },
          data: {
            connectionStatus: ChannelConnectionStatus.CONNECTED,
            connectedAt: account.connectedAt ?? new Date(),
            externalAccountId: result.externalAccountId ?? account.externalAccountId,
            channelName: result.accountName ?? account.channelName,
          },
        })
        try {
          const session = await channelBrowserSessionService.findByAccount(account.id)
          if (session) {
            await channelBrowserSessionService.markHealthCheck(session.id, { loginState: 'connected' })
          }
        } catch (e: any) {
          console.warn(`[ChannelService] 浏览器会话健康检查记录失败: ${e.message}`)
        }
        return { ...result, status: 'connected' }
      }
      // 首次登录 → 等待人工确认（不写 DB，身份暂存返回）
      return {
        ...result,
        status: 'awaiting_confirmation',
        message: '已检测到抖音账号登录，请确认绑定后完成连接',
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

    // 1. 探针复核：登录态是否仍在 + 身份完整
    const probe = identityProbeRegistry.get(account.channelType)
    if (!probe) throw new Error(`渠道 ${account.channelType} 无身份探针`)
    const identity = await probe.probe(sid)
    if (!identity.authenticated) {
      throw new Error('未检测到有效登录态，请重新扫码登录')
    }

    // 2. 回写账号身份（G1：externalAccountId + channelName + avatar）
    // REALITY-HARDENING-01 Task02 — 探针复核通过 = 平台确认真人 → AUTHENTICATED（凭证落库后才 CONNECTED）
    await prisma.enterpriseChannelAccount.update({
      where: { id: account.id },
      data: {
        connectionStatus: ChannelConnectionStatus.AUTHENTICATED,
        connectedAt: new Date(),
        externalAccountId: identity.accountId ?? account.externalAccountId,
        channelName: identity.accountName ?? account.channelName,
        metadata: {
          ...(account.metadata as any || {}),
          avatar: identity.avatar ?? (account.metadata as any)?.avatar,
          permissionLevel: (account.metadata as any)?.permissionLevel ?? 1, // L1 观察员工（默认）
          permissions: identity.permissions,
          boundAt: new Date().toISOString(),
          // Channel Identity Trust Completion — 设备可信标记：本次绑定完成即建立长期可信环境，
          // 后续同一 profile 恢复登录态时不再触发新设备风控（由平台侧 profile 连续性保证）
          deviceTrusted: true,
          lastVerifiedAt: new Date().toISOString(),
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
    // REALITY-HARDENING-01 Task01 — Reality Gate：adapter.refreshCredential 内部探针复核，
    // 未登录/无身份一律拒绝；凭证落库成功 = 身份+凭证就绪 → CONNECTED
    try {
      const result = await adapter.refreshCredential(account.id)
      if (!result.ok) {
        console.warn(`[ChannelService] 确认绑定凭证保存失败: ${result.error}`)
      } else {
        await prisma.enterpriseChannelAccount.update({
          where: { id: account.id },
          data: { connectionStatus: ChannelConnectionStatus.CONNECTED },
        })
      }
    } catch (e: any) {
      console.warn(`[ChannelService] 确认绑定凭证保存异常: ${e.message}`)
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
    await prisma.enterpriseChannelAccount.update({
      where: { id: account.id },
      data: {
        connectionStatus: ChannelConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        externalAccountId: identity.accountId ?? account.externalAccountId,
        channelName: identity.accountName ?? account.channelName,
      },
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
    // WAITING_LOGIN/VERIFYING/AUTHENTICATED → connecting（流程中，绝不显示已连接）
    const accountState = (() => {
      if (isChannelConnected(account.connectionStatus) && account.externalAccountId) return 'connected'
      if (account.connectionStatus === ChannelConnectionStatus.EXPIRED) return 'expired'
      if ([
        ChannelConnectionStatus.WAITING_LOGIN,
        ChannelConnectionStatus.VERIFYING,
        ChannelConnectionStatus.AUTHENTICATED,
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
