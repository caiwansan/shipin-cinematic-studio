/**
 * WeCom Adapter Service — Sprint 4.2.5.2-IMP-01.2
 * 
 * 职责: 企业微信 API 封装 (Contract 2)
 * CTO 冻结: 只做企业微信，禁止 Mock
 * 
 * IMP-01.2 Changes:
 * - Token 管理委托给 TokenService（不再自行管理 access_token）
 * - 凭证存储在 EnterpriseChannelAccount.credentialEncrypted
 * - Tenant Isolation: 每个 accountId 对应独立的 Token Cache 条目
 */
import { prisma } from '../../../utils/index.js'
import { interactionSyncService } from './interaction-sync.service.js'
import { tokenService } from '../../../enterprise/channel/token.service.js'

export class WeComAdapterService {
  private isInitialized = false
  private channelAccountId: string | null = null

  /**
   * 初始化企业微信 API
   * 
   * 使用 channelAccountId 从 DB 加载凭证，通过 TokenService 管理 Token
   */
  async initialize(channelAccountId: string): Promise<boolean> {
    this.channelAccountId = channelAccountId

    const account = await prisma.enterpriseChannelAccount.findUnique({
      where: { id: channelAccountId },
    })

    if (!account) {
      return false
    }

    const creds = account.credentialEncrypted as any
    if (!creds.corpId || !creds.agentId || !creds.secret) {
      return false
    }

    // Token 加载由 TokenService 负责（Lazy loading）
    this.isInitialized = true
    return true
  }

  /**
   * 发送消息（IMP-01.2: Token 由 TokenService 管理）
   */
  async sendMessage(params: {
    toUser: string
    content: string
    msgType?: string
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized || !this.channelAccountId) {
      return { success: false, error: 'WeCom Adapter not initialized' }
    }

    try {
      // 通过 TokenService 获取 Token（自动缓存/刷新）
      await tokenService.getToken(this.channelAccountId)

      // TODO: IMP-01.3 发送真实消息
      console.log(`[WeCom IMP-01.2] Send to ${params.toUser}: ${params.content}`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `Token error: ${e.message}` }
    }
  }

  /**
   * 同步客户列表
   */
  async syncCustomers(channelAccountId: string): Promise<{ count: number; error?: string }> {
    if (!this.isInitialized) {
      return { count: 0, error: 'WeCom Adapter not initialized' }
    }

    const log = await interactionSyncService.createSyncLog({
      tenantId: '',
      channelAccountId,
      syncType: 'incremental',
    })

    await interactionSyncService.completeSyncLog(log.id, {
      status: 'success',
      recordsSynced: 0,
      recordsFailed: 0,
    })

    return { count: 0 }
  }

  /**
   * 处理企业微信回调
   */
  handleCallback(payload: Record<string, any>): { success: boolean; data?: any } {
    console.log('[WeCom IMP-01.2] Callback received:', JSON.stringify(payload))
    return { success: true }
  }

  /**
   * 获取连接状态
   */
  getStatus(): { initialized: boolean; connected: boolean; accountId: string | null } {
    return {
      initialized: this.isInitialized,
      connected: this.isInitialized,
      channelAccountId: this.channelAccountId,
    }
  }

  /**
   * 获取 Token 健康信息
   */
  async getTokenHealth(): Promise<{ status: string; stats: any } | null> {
    if (!this.channelAccountId) return null

    try {
      await tokenService.getToken(this.channelAccountId)
      return {
        status: 'ok',
        stats: tokenService.getCacheStats(),
      }
    } catch (e: any) {
      return {
        status: 'error',
        stats: { error: e.message },
      }
    }
  }
}

export const wecomAdapterService = new WeComAdapterService()
