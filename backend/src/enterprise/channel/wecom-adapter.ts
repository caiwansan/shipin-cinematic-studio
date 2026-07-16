/**
 * P4.2.5.2-IMP-01.2 — WeCom Channel Adapter (Token Lifecycle Integrated)
 * 
 * WeCom Channel Adapter - implements ChannelAdapter<WeComConfig>
 * 
 * CTO Frozen Rules:
 * - Channel ≠ Business Logic (只数据入口，不决策)
 * - Provider Isolation (未来可替换为其他渠道)
 * - External Data Must Enter Envelope (原始数据不直接进 UI)
 * 
 * Token 管理: 全部委托给 TokenService，Adapter 不持有 Token 状态
 */

import type {
  ChannelAdapter,
  WeComConfig,
  ChannelConnection,
  ChannelSyncResult,
  ChannelMessage,
  MessageResult,
  ChannelHealth,
  ExternalChannelEvent,
  InteractionEvent,
  CustomerIdentity,
} from './channel-adapter.interface.js'
import { WeComClient, WeComApiError } from './wecom-client.js'
import { tokenService } from './token.service.js'

/**
 * IMP-01.5: WeCom Event → Canonical Interaction Type Mapping
 * 
 * Maps raw WeCom event/message types to canonical InteractionEvent types.
 */
const EVENT_TYPE_MAP: Record<string, string> = {
  // Customer lifecycle events (change_external_contact)
  'change_external_contact': 'CUSTOMER_UPDATED',
  'add_external_contact': 'CUSTOMER_CREATED',
  'del_external_contact': 'CUSTOMER_REMOVED',
  'edit_external_contact': 'CUSTOMER_UPDATED',
  // Message types — text
  'text': 'MESSAGE',
  'msg': 'MESSAGE',
  // Message types — media
  'image': 'MEDIA',
  'voice': 'VOICE',
  'video': 'MEDIA',
  'file': 'MEDIA',
  'location': 'MESSAGE',
  'link': 'MESSAGE',
  'miniprogram': 'MESSAGE',
  'event': 'UNKNOWN',
}

export class WeComAdapter implements ChannelAdapter<WeComConfig> {
  readonly platform = 'wecom'
  private client: WeComClient | null = null
  private config: WeComConfig | null = null
  private channelAccountId: string | null = null

  /**
   * 连接 WeCom
   * 
   * Token 验证委托给 TokenService → 真实 API 调用
   */
  async connect(config: WeComConfig): Promise<ChannelConnection> {
    this.config = config

    // 临时 Client（无 accountId，仅验证连接）
    this.client = new WeComClient('standalone')

    // 验证连接（TokenService 会自动 fetch token）
    const health = await this.client.healthCheck()

    return {
      channelAccountId: this.channelAccountId || 'standalone',
      connected: health.status === 'ok',
      connectedAt: health.status === 'ok' ? new Date().toISOString() : undefined,
    }
  }

  /**
   * 使用 ChannelAccountId 初始化 Adapter
   * 
   * Token 会基于此 accountId 从 DB 加载 credential
   */
  async initWithChannelAccount(channelAccountId: string): Promise<ChannelConnection> {
    this.channelAccountId = channelAccountId
    this.client = new WeComClient(channelAccountId)

    const health = await this.client.healthCheck()
    return {
      channelAccountId,
      connected: health.status === 'ok',
      connectedAt: health.status === 'ok' ? new Date().toISOString() : undefined,
    }
  }

  /**
   * 断开连接（Token 由 Cache TTL 管理，无需手动清除）
   */
  async disconnect(): Promise<void> {
    // 使当前 Token 失效
    if (this.channelAccountId) {
      await tokenService.invalidateToken(this.channelAccountId, 'Adapter disconnected')
    }
    this.client = null
    this.config = null
  }

  /**
   * 同步外部数据
   */
  async sync(): Promise<ChannelSyncResult> {
    if (!this.client || !this.channelAccountId) {
      throw new WeComApiError('NOT_CONNECTED', 'WeCom client not connected', -1)
    }

    const startedAt = new Date().toISOString()

    try {
      // 验证 token 可用性（Token 由 Service 管理）
      const token = await tokenService.getToken(this.channelAccountId)

      return {
        channelAccountId: this.channelAccountId,
        syncedCount: 0,
        failedCount: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: 'success',
      }
    } catch (e: any) {
      return {
        channelAccountId: this.channelAccountId,
        syncedCount: 0,
        failedCount: 1,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: 'failed',
      }
    }
  }

  /**
   * 发送消息
   * 
   * Message Sending Flow:
   * 1. TokenService.getToken(accountId) → Cache or Refresh
   * 2. fetch(WeCom API) → WeCom Response
   * 3. Error? → TokenService.handleError() → Retry or Fail
   */
  async send(message: ChannelMessage): Promise<MessageResult> {
    if (!this.client || !this.config || !this.channelAccountId) {
      throw new WeComApiError('NOT_CONNECTED', 'WeCom client not connected', -1)
    }

    try {
      const result = await this.client.sendMessage({
        touser: message.receiver,
        agentid: this.config.agentId,
        msgtype: message.contentType === 'text' ? 'text' : message.contentType,
        content: { content: message.content },
      })

      return {
        messageId: result.msgid || `wecom_${Date.now()}`,
        status: result.errcode === 0 ? 'sent' : 'failed',
        error: result.errmsg,
      }
    } catch (e: any) {
      if (e instanceof WeComApiError && (e.wechatCode === 42001 || e.wechatCode === 40014)) {
        // Token expired during send → auto retry
        try {
          const result = await this.client.sendMessage({
            touser: message.receiver,
            agentid: this.config.agentId,
            msgtype: message.contentType === 'text' ? 'text' : message.contentType,
            content: { content: message.content },
          })
          return {
            messageId: result.msgid || `wecom_${Date.now()}`,
            status: result.errcode === 0 ? 'sent' : 'failed',
            error: result.errmsg,
          }
        } catch (retryError: any) {
          return {
            messageId: '',
            status: 'failed',
            error: `Token retry failed: ${retryError.message}`,
          }
        }
      }
      return {
        messageId: '',
        status: 'failed',
        error: e.message,
      }
    }
  }

  /**
   * 接收外部事件
   */
  async receive(event: ExternalChannelEvent): Promise<void> {
    // 事件接收在 WeComCallbackController 中处理
  }

  /**
   * 健康检查
   * 
   * ChannelHealth 状态:
   * - connected: Token 可用
   * - error: 凭证无效 / Token 获取失败
   * - expired: Token 已过期（正在 refresh）
   */
  async health(): Promise<ChannelHealth> {
    if (!this.client || !this.channelAccountId) {
      return {
        channel: 'wecom',
        channelAccountId: this.channelAccountId || 'unknown',
        status: 'disconnected',
      }
    }

    try {
      const result = await this.client.healthCheck()
      return {
        channel: 'wecom',
        channelAccountId: this.channelAccountId,
        status: result.status === 'ok' ? 'connected' : 'error',
        errorMessage: result.message,
        lastSyncAt: new Date().toISOString(),
      }
    } catch (e: any) {
      return {
        channel: 'wecom',
        channelAccountId: this.channelAccountId,
        status: 'error',
        errorMessage: e.message,
      }
    }
  }

  /**
   * 设置 Channel Account ID
   */
  setChannelAccountId(id: string): void {
    this.channelAccountId = id
    this.client = new WeComClient(id)
  }

  /**
   * 获取 WeCom Client（供 Controller 使用）
   */
  getClient(): WeComClient | null {
    return this.client
  }

  /**
   * 获取 Config
   */
  getConfig(): WeComConfig | null {
    return this.config
  }

  /**
   * 获取 TokenService 统计（供 Debug 使用）
   */
  getTokenStats() {
    return tokenService.getCacheStats()
  }

  /**
   * WeCom 事件 → InteractionEvent 标准化
   * 
   * 这是唯一的数据转换点
   */
  normalizeEvent(rawEvent: any): InteractionEvent {
    const eventType = rawEvent.Event || rawEvent.msgtype || 'unknown'
    const internalType = EVENT_TYPE_MAP[eventType] || 'UNKNOWN'
    const externalUserId = rawEvent.UserID || rawEvent.from || rawEvent.external_userid || 'unknown'
    const occurredAt = rawEvent.CreateTime
      ? new Date(rawEvent.CreateTime * 1000).toISOString()
      : new Date().toISOString()

    return {
      id: `wecom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      channel: 'wecom',
      type: internalType,
      actor: externalUserId,
      customer: {
        id: externalUserId,
        channel: 'wecom',
        externalId: externalUserId,
        mappingStatus: 'pending',
      },
      payload: rawEvent,
      timestamp: occurredAt,
    }
  }

  /**
   * 获取 API 基础 URL
   */
  static getApiBaseUrl(): string {
    return 'https://qyapi.weixin.qq.com/cgi-bin'
  }
}
