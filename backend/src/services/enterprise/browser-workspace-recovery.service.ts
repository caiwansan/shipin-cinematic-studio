/**
 * BrowserWorkspaceRecoveryService — SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 Task 02
 *
 * 启动恢复流程（Channel Identity Rehydration）：
 *
 *   server restart
 *     ↓
 *   scan BrowserWorkspace (status ∈ RUNNING/READY/CREATED)
 *     ↓
 *   open persistent profile（同一 profile = 登录时写入登录态的目录）
 *     ↓
 *   run IdentityProbe（三信号：页面特征 + Cookie + 身份提取）
 *     ↓
 *   restore ChannelAccount.connectionStatus（CONNECTED 保持 / 中断流程回退 EXPIRED）
 *
 * ── 掌柜原则 ──
 * - 电脑开机 ≠ 用户登录：workspace RUNNING 只是浏览器活着，是否「在线」必须由探针判定
 * - 未登录账号不能显示在线：探针未通过 → CONNECTED 一律降级 EXPIRED
 * - 不猜登录状态：identity 必须来自 IdentityProbe（authenticated + externalAccountId）
 * - 幂等 + 串行 + 错误隔离：单账号失败不影响其他账号恢复
 *
 * ── 状态处理矩阵 ──
 * | account.connectionStatus | 恢复动作                                        |
 * |--------------------------|-------------------------------------------------|
 * | CONNECTED                | 拉起 profile → 探针 → 通过：保持 CONNECTED+健康标记 |
 * |                          |                → 未通过：close + EXPIRED          |
 * | AUTHENTICATED            | 凭证未落库（重启中断）→ EXPIRED（需重新授权）      |
 * | WAITING_LOGIN/VERIFYING  | 扫码流程已被重启打断 → EXPIRED（需重新连接）       |
 * | PENDING/EXPIRED/ERROR    | 跳过（无需恢复）；workspace 归位 READY             |
 */
import { prisma } from '../../utils/index.js'
import { browserRuntime } from '../media/browser-runtime.service.js'
import { identityProbeRegistry } from '../../enterprise/channel/identity-probe.js'
import { ChannelConnectionStatus, isChannelConnected } from '../../constants/channel-connection-status.js'
import { browserWorkspaceService } from './browser-workspace.service.js'

export class BrowserWorkspaceRecoveryService {
  private recovering = false

  /**
   * 启动恢复：扫描全部 workspace（media 域优先，全域亦可），逐个恢复
   * 幂等：可重复调用；并发保护：同一时刻只允许一个恢复任务
   */
  async recoverAll(opts?: { businessType?: string; verbose?: boolean }): Promise<{
    scanned: number
    recovered: number
    keptConnected: number
    demoted: number
    skipped: number
    failed: number
    details: { accountId: string; platform: string; action: string; message: string }[]
  }> {
    if (this.recovering) {
      return { scanned: 0, recovered: 0, keptConnected: 0, demoted: 0, skipped: 0, failed: 0, details: [{ accountId: '', platform: '', action: 'skip', message: '恢复任务进行中，跳过本次触发' }] }
    }
    this.recovering = true
    const verbose = opts?.verbose ?? true
    const details: { accountId: string; platform: string; action: string; message: string }[] = []
    let keptConnected = 0
    let demoted = 0
    let skipped = 0
    let failed = 0

    try {
      const where: any = { status: { in: ['RUNNING', 'READY', 'CREATED'] } }
      if (opts?.businessType) where.businessType = opts.businessType
      const workspaces = await prisma.browserWorkspace.findMany({ where })
      const scanned = workspaces.length
      if (verbose) console.log(`[BrowserWorkspaceRecovery] 扫描到 ${scanned} 个工作空间（${opts?.businessType || '全部域'}）`)

      // 串行恢复（避免同时拉起多个 Chromium 实例）
      for (const ws of workspaces) {
        try {
          const account = await prisma.enterpriseChannelAccount.findUnique({
            where: { id: ws.channelAccountId },
            select: {
              id: true,
              channelType: true,
              channelName: true,
              connectionStatus: true,
              externalAccountId: true,
              metadata: true,
              connectedAt: true,
            },
          })
          if (!account) {
            skipped++
            details.push({ accountId: ws.channelAccountId, platform: ws.businessType, action: 'skip', message: '渠道账号不存在，跳过' })
            continue
          }

          const platform = account.channelType
          const sid = await browserWorkspaceService.resolveSessionId(account.id, platform)
          const profilePath = ws.profilePath

          // ── 按账号状态分派 ──
          if (isChannelConnected(account.connectionStatus)) {
            // CONNECTED：必须用真实探针验证登录态是否仍存活
            const ok = await this.recoverConnectedAccount(ws, account, sid, profilePath, details)
            if (ok) keptConnected++
            else demoted++
          } else if (
            account.connectionStatus === ChannelConnectionStatus.AUTHENTICATED ||
            account.connectionStatus === ChannelConnectionStatus.WAITING_LOGIN ||
            account.connectionStatus === ChannelConnectionStatus.VERIFYING
          ) {
            // 进行中流程被重启打断：扫码/验证不可能跨进程存活 → 回退 EXPIRED，绝不假装在线
            await prisma.enterpriseChannelAccount.update({
              where: { id: account.id },
              data: {
                connectionStatus: ChannelConnectionStatus.EXPIRED,
                lastError: '服务重启导致登录流程中断，请重新连接授权',
              },
            })
            await this.settleWorkspaceIdle(ws.id, 'login_flow_interrupted')
            demoted++
            details.push({ accountId: account.id, platform, action: 'demote', message: `${account.connectionStatus} → EXPIRED（服务重启中断登录流程）` })
            if (verbose) console.log(`[BrowserWorkspaceRecovery] ⚠️ ${account.id} ${account.connectionStatus} → EXPIRED（重启中断）`)
          } else {
            // PENDING / EXPIRED / ERROR：无需恢复登录，仅确保 workspace 状态归位（浏览器未运行）
            if (ws.status !== 'READY') {
              await this.settleWorkspaceIdle(ws.id, 'account_not_connected')
            }
            skipped++
            details.push({ accountId: account.id, platform, action: 'skip', message: `账号状态 ${account.connectionStatus}，无需恢复` })
          }
        } catch (e: any) {
          failed++
          details.push({ accountId: ws.channelAccountId, platform: ws.businessType, action: 'error', message: e.message })
          console.warn(`[BrowserWorkspaceRecovery] ❌ ${ws.channelAccountId} 恢复失败: ${e.message}`)
        }
      }

      if (verbose) console.log(`[BrowserWorkspaceRecovery] ✅ 完成：扫描 ${scanned} / 保持连接 ${keptConnected} / 降级 ${demoted} / 跳过 ${skipped} / 失败 ${failed}`)
      return { scanned, recovered: keptConnected, keptConnected, demoted, skipped, failed, details }
    } finally {
      this.recovering = false
    }
  }

  /**
   * CONNECTED 账号恢复：
   * 1. 拉起持久化 profile（与登录链路同一 sessionId/profile → 登录态直接恢复）
   * 2. 导航到平台（探针需要工作台页面；连不上平台页面也继续探针，信号不足即降级）
   * 3. IdentityProbe 三信号判定
   * 4. 通过：保持 CONNECTED + 更新身份快照（lastVerifiedAt）+ 健康标记
   *    未通过：close 实例 + CONNECTED → EXPIRED + workspace → READY
   */
  private async recoverConnectedAccount(
    ws: any,
    account: { id: string; channelType: string; channelName: string; connectionStatus: string; externalAccountId: string | null; metadata: any; connectedAt: Date | null },
    sid: string,
    profilePath: string,
    details: { accountId: string; platform: string; action: string; message: string }[],
  ): Promise<boolean> {
    const platform = account.channelType
    const profileExists = await this.profileExists(profilePath)
    if (!profileExists) {
      // profile 都没了 → 登录态不可能存在
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: { connectionStatus: ChannelConnectionStatus.EXPIRED, lastError: '浏览器 profile 缺失，登录态不可恢复，请重新授权' },
      })
      await this.settleWorkspaceIdle(ws.id, 'profile_missing')
      details.push({ accountId: account.id, platform, action: 'demote', message: 'profile 目录不存在 → EXPIRED' })
      return false
    }

    // 1. 拉起同一持久化 profile（登录时写入登录态的目录）
    await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: false })
    // 2. 导航平台首页（探针页面特征信号需要工作台 URL；导航失败不阻断探针）
    try {
      const meta = await this.platformLoginUrl(platform)
      if (meta) await browserRuntime.navigate(sid, meta, { headless: false })
    } catch (e: any) {
      console.warn(`[BrowserWorkspaceRecovery] ${platform} 导航失败（继续探针）: ${e.message}`)
    }

    // 3. 探针三信号判定（页面特征 + Cookie + 身份提取）
    const probe = identityProbeRegistry.get(platform)
    if (!probe) {
      await browserRuntime.close(sid)
      await this.settleWorkspaceIdle(ws.id, 'no_probe')
      details.push({ accountId: account.id, platform, action: 'error', message: `平台 ${platform} 无身份探针 → 保守降级 EXPIRED` })
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: { connectionStatus: ChannelConnectionStatus.EXPIRED, lastError: '无身份探针，无法确认登录态' },
      })
      return false
    }

    let identity: Awaited<ReturnType<typeof probe.probe>> | null = null
    try {
      identity = await probe.probe(sid)
    } catch (e: any) {
      console.warn(`[BrowserWorkspaceRecovery] ${account.id} 探针异常: ${e.message}`)
    }

    const authenticated = !!identity?.authenticated && !!identity.accountId
    if (authenticated && identity) {
      // 4a. 保持 CONNECTED + 更新身份快照（G1：identity 完整；owner-view 新鲜度判定依据）
      const nowIso = new Date().toISOString()
      const meta = (account.metadata as any) || {}
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: {
          connectionStatus: ChannelConnectionStatus.CONNECTED,
          connectedAt: account.connectedAt ?? new Date(),
          externalAccountId: identity.accountId ?? account.externalAccountId,
          channelName: identity.accountName ?? account.channelName,
          metadata: {
            ...meta,
            avatar: identity.avatar ?? meta.avatar,
            lastVerifiedAt: nowIso,
            identitySnapshot: {
              externalAccountId: identity.accountId,
              accountName: identity.accountName ?? account.channelName,
              avatar: identity.avatar ?? meta.avatar ?? null,
              checkedAt: nowIso,
              via: 'startup_recovery',
            },
            recoveryCount: (meta.recoveryCount ?? 0) + 1,
            lastRecoveredAt: nowIso,
          },
        },
      })
      if (ws.status !== 'RUNNING') {
        await prisma.browserWorkspace.update({ where: { id: ws.id }, data: { status: 'RUNNING', lastStartedAt: new Date() } })
      }
      await prisma.browserWorkspace.update({ where: { id: ws.id }, data: { lastHealthCheckAt: new Date(), lastError: null } })
      // 同步浏览器会话健康记录
      await this.markBrowserSession(account.id, { loginState: 'connected', recoveredAt: nowIso })
      details.push({ accountId: account.id, platform, action: 'keep', message: `探针通过（${identity.accountName ?? '已登录'}）→ CONNECTED 保持` })
      console.log(`[BrowserWorkspaceRecovery] ✅ ${platform}:${account.id} 登录态恢复（${identity.accountName ?? '已登录'}）`)
      return true
    }

    // 4b. 未通过：登录态已失效 → 关闭实例 + EXPIRED（未登录绝不显示在线）
    await browserRuntime.close(sid).catch(() => {})
    await this.settleWorkspaceIdle(ws.id, 'login_expired')
    const reason = identity && !identity.authenticated ? '探针未检测到有效登录态' : '探针未返回账号身份（externalAccountId 缺失）'
    await prisma.enterpriseChannelAccount.update({
      where: { id: account.id },
      data: { connectionStatus: ChannelConnectionStatus.EXPIRED, lastError: `${reason}，请重新扫码授权` },
    })
    details.push({ accountId: account.id, platform, action: 'demote', message: `探针未通过 → CONNECTED → EXPIRED（${reason}）` })
    console.warn(`[BrowserWorkspaceRecovery] ⚠️ ${platform}:${account.id} 登录态失效 → EXPIRED`)
    return false
  }

  /** workspace 归位 READY（浏览器未运行，电脑在但未开机） */
  private async settleWorkspaceIdle(workspaceId: string, reason: string): Promise<void> {
    try {
      await prisma.browserWorkspace.update({
        where: { id: workspaceId },
        data: { status: 'READY', lastError: reason === 'login_expired' ? '平台登录态失效，等待重新授权' : reason === 'login_flow_interrupted' ? '服务重启中断登录流程，请重新连接' : reason === 'profile_missing' ? '浏览器 profile 缺失' : reason === 'no_probe' ? '无身份探针' : '账号未连接' },
      })
    } catch (e: any) {
      console.warn(`[BrowserWorkspaceRecovery] workspace 归位失败 ${workspaceId}: ${e.message}`)
    }
  }

  /** 同步 ChannelBrowserSession 健康记录（恢复即健康） */
  private async markBrowserSession(channelAccountId: string, meta: Record<string, unknown>): Promise<void> {
    try {
      const session = await prisma.channelBrowserSession.findUnique({ where: { channelAccountId_browserType: { channelAccountId, browserType: 'chromium' } } })
      if (session) {
        await prisma.channelBrowserSession.update({
          where: { id: session.id },
          data: { status: 'RUNNING', lastHealthCheckAt: new Date(), metadata: { ...((session.metadata as any) || {}), ...meta } },
        })
      }
    } catch (e: any) {
      console.warn(`[BrowserWorkspaceRecovery] 浏览器会话健康同步失败: ${e.message}`)
    }
  }

  private async profileExists(profilePath: string): Promise<boolean> {
    try {
      const fs = await import('fs')
      return fs.existsSync(profilePath)
    } catch {
      return false
    }
  }

  /** 平台首页/工作台 URL（探针页面特征信号需要） */
  private async platformLoginUrl(platform: string): Promise<string | null> {
    try {
      const { CHANNEL_META } = await import('../../enterprise/channel/adapters/browser-channel.meta.js')
      const meta = CHANNEL_META[platform]
      if (meta?.loginUrl) return meta.loginUrl
    } catch {}
    if (platform === 'douyin') return 'https://creator.douyin.com/'
    return null
  }
}

export const browserWorkspaceRecoveryService = new BrowserWorkspaceRecoveryService()
