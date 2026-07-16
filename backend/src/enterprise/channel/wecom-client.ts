/**
 * P4.2.5.2-IMP-01.2 — WeCom SDK Client (Refactored with TokenService)
 * 
 * WeCom API 客户端
 * CTO Rule: No Mock → 真实 WeCom API 调用
 * 
 * Token 管理已解耦到 TokenService + TokenCache
 * 此 Client 只负责 API 调用（不涉及 Token 获取逻辑）
 */

import { tokenService } from './token.service.js'
import type { WeComConfig } from './channel-adapter.interface.js'

const WECHAT_WORK_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin'

export class WeComClient {
  private channelAccountId: string

  constructor(channelAccountId: string) {
    this.channelAccountId = channelAccountId
  }

  /**
   * 获取 access_token（委托给 TokenService）
   */
  private async getAccessToken(): Promise<string> {
    return tokenService.getToken(this.channelAccountId)
  }

  /**
   * 发送消息（应用消息推送）
   * https://developer.work.weixin.qq.com/document/path/90236
   */
  async sendMessage(params: {
    touser?: string
    toparty?: string
    totag?: string
    agentid: string
    msgtype: string
    content: any
  }): Promise<{ msgid?: string; errcode: number; errmsg: string }> {
    return this.apiCallWithRetry(async () => {
      const token = await this.getAccessToken()
      const url = `${WECHAT_WORK_API_BASE}/message/send?access_token=${token}`
      const body = {
        touser: params.touser || '@all',
        toparty: params.toparty || '',
        totag: params.totag || '',
        agentid: params.agentid,
        msgtype: params.msgtype,
        [params.msgtype]: params.content,
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return await res.json() as any
    }, { msgtype: params.msgtype, agentid: params.agentid })
  }

  /**
   * 获取外部联系人列表
   * https://developer.work.weixin.qq.com/document/path/92113
   */
  async getExternalContacts(userId: string): Promise<any[]> {
    return this.apiCallWithRetry(async () => {
      const token = await this.getAccessToken()
      const url = `${WECHAT_WORK_API_BASE}/externalcontact/get?access_token=${token}&userid=${userId}`
      const res = await fetch(url)
      const data = await res.json() as any

      if (data.errcode !== 0) throw new WeComApiError('GET_CONTACTS_FAILED', data.errmsg, data.errcode)
      return data.external_contact_list || []
    }, { userId })
  }

  /**
   * 获取外部联系人详情
   * https://developer.work.weixin.qq.com/document/path/92114
   */
  async getExternalContactDetail(externalUserId: string): Promise<any> {
    return this.apiCallWithRetry(async () => {
      const token = await this.getAccessToken()
      const url = `${WECHAT_WORK_API_BASE}/externalcontact/get?access_token=${token}&external_userid=${externalUserId}`
      const res = await fetch(url)
      const data = await res.json() as any

      if (data.errcode !== 0) throw new WeComApiError('GET_CONTACT_DETAIL_FAILED', data.errmsg, data.errcode)
      return data.external_contact
    }, { externalUserId })
  }

  /**
   * 通用 API 调用
   */
  async callApi<T = any>(path: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<T> {
    return this.apiCallWithRetry(async () => {
      const token = await this.getAccessToken()
      const url = `${WECHAT_WORK_API_BASE}${path}?access_token=${token}`

      const options: RequestInit = { method }
      if (body && method === 'POST') {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify(body)
      }

      const res = await fetch(url, options)
      const data = await res.json() as any

      if (data.errcode !== 0) throw new WeComApiError('API_CALL_FAILED', data.errmsg, data.errcode)
      return data as T
    }, { path, method })
  }

  /**
   * 健康检查 - 测试 token 是否有效
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      await this.getAccessToken()
      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', message: e.message }
    }
  }

  // ─── Internal Retry Logic ────────────────────────────────

  /**
   * 通用的 API 调用 + 错误处理 + 自动重试
   * 
   * 遇到 Token 过期（42001/40014）→ 自动 invalidate + refresh + retry 1次
   */
  private async apiCallWithRetry<T>(
    fn: (info?: { token?: string }) => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    try {
      return await fn()
    } catch (error: any) {
      // Mapping token errors via TokenService
      if (error instanceof WeComApiError) {
        const action = await tokenService.handleError(this.channelAccountId, error)
        if (action === 'retry') {
          // Retry once after token refresh
          try {
            return await fn()
          } catch (retryError: any) {
            // Retry still fails → mark as ERROR and throw
            await tokenService.invalidateToken(
              this.channelAccountId,
              `Retry failed: ${retryError.message}`
            )
            throw retryError
          }
        }
        // action === 'fail' → just throw
      }
      throw error
    }
  }
}

// ─── WeCom API Error ───────────────────────────────────────

export class WeComApiError extends Error {
  code: string
  wechatCode: number

  constructor(code: string, message: string, wechatCode: number) {
    super(message)
    this.name = 'WeComApiError'
    this.code = code
    this.wechatCode = wechatCode
  }
}
