/**
 * ChannelBrowserSessionService — TASK03.1.5 Browser Runtime Upgrade
 *
 * 职责：维护渠道账号的「运行环境」记录（ChannelBrowserSession），与账号身份（EnterpriseChannelAccount）分离
 * - 账号身份 = EnterpriseChannelAccount（凭证/状态/归属）
 * - 运行环境 = ChannelBrowserSession（浏览器 profile 路径/启动时间/健康检查）
 *
 * 边界（掌柜批准）：
 * - 不存储凭证/cookie（唯一凭证源仍是 EnterpriseChannelAccount.credentialEncrypted）
 * - 不包含 AI 员工逻辑 / 操作日志（OperationLog 属 Task05）
 * - profilePath 由 BrowserRuntimeService.getProfilePath 计算（单一事实源）
 */
import { prisma } from '../../utils/index.js'

export type BrowserSessionStatus = 'IDLE' | 'RUNNING' | 'ERROR'

export class ChannelBrowserSessionService {
  /**
   * 获取或创建渠道账号的浏览器会话记录（upsert by channelAccountId + browserType）
   */
  async getOrCreate(
    channelAccountId: string,
    opts: { browserType?: string; profilePath?: string } = {},
  ): Promise<{
    id: string
    channelAccountId: string
    browserType: string
    profilePath: string
    status: BrowserSessionStatus
  }> {
    const browserType = opts.browserType || 'chromium'
    const profilePath = opts.profilePath || ''
    const existing = await prisma.channelBrowserSession.findUnique({
      where: {
        channelAccountId_browserType: { channelAccountId, browserType },
      },
    })
    if (existing) {
      // profile 路径变化时跟随更新（首次创建时由上层传入）
      if (profilePath && existing.profilePath !== profilePath) {
        const updated = await prisma.channelBrowserSession.update({
          where: { id: existing.id },
          data: { profilePath },
        })
        return this.map(updated)
      }
      return this.map(existing)
    }
    const created = await prisma.channelBrowserSession.create({
      data: {
        channelAccountId,
        browserType,
        profilePath,
        status: 'IDLE',
        metadata: {},
      },
    })
    return this.map(created)
  }

  /**
   * 标记会话已启动（浏览器实例拉起）
   */
  async markStarted(id: string): Promise<void> {
    await prisma.channelBrowserSession.update({
      where: { id },
      data: { status: 'RUNNING', lastStartedAt: new Date() },
    })
  }

  /**
   * 标记健康检查通过（登录态有效等）
   */
  async markHealthCheck(id: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await prisma.channelBrowserSession.update({
      where: { id },
      data: { lastHealthCheckAt: new Date(), metadata: metadata as any },
    })
  }

  /**
   * 标记会话错误（浏览器崩溃/登录态失效等）
   */
  async markError(id: string, error: string): Promise<void> {
    await prisma.channelBrowserSession.update({
      where: { id },
      data: { status: 'ERROR', lastError: String(error).slice(0, 1000) },
    })
  }

  /**
   * 恢复为 IDLE（正常关闭后）
   */
  async markIdle(id: string): Promise<void> {
    await prisma.channelBrowserSession.update({
      where: { id },
      data: { status: 'IDLE' },
    })
  }

  /**
   * 查询账号的浏览器会话（含 profile 环境信息）
   */
  async findByAccount(channelAccountId: string): Promise<{
    id: string
    channelAccountId: string
    browserType: string
    profilePath: string
    status: BrowserSessionStatus
    lastStartedAt: Date | null
    lastHealthCheckAt: Date | null
    lastError: string | null
  } | null> {
    const found = await prisma.channelBrowserSession.findUnique({
      where: {
        channelAccountId_browserType: { channelAccountId, browserType: 'chromium' },
      },
    })
    return found ? this.map(found) : null
  }

  private map(row: any) {
    return {
      id: row.id,
      channelAccountId: row.channelAccountId,
      browserType: row.browserType,
      profilePath: row.profilePath,
      status: row.status,
      lastStartedAt: row.lastStartedAt,
      lastHealthCheckAt: row.lastHealthCheckAt,
      lastError: row.lastError,
    }
  }
}

export const channelBrowserSessionService = new ChannelBrowserSessionService()
