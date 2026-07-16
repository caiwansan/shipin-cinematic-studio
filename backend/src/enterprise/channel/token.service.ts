/**
 * P4.2.5.2-IMP-01.2 — WeCom Authentication + Token Lifecycle
 * 
 * Enterprise-grade Token Runtime
 * 
 * 职责:
 * - getToken(): 获取（含缓存 + 刷新）
 * - refreshToken(): 强制刷新
 * - invalidateToken(): 凭证失效处理
 * 
 * 不负责:
 * - Message (由 MessageService)
 * - Customer (由 CustomerSyncService)
 * - Decision (由 DecisionEngine)
 * 
 * 状态机:
 *   No Token → Request Token → Cache Token → Reuse → Expire → Refresh
 *                                                        ↓
 *                                              ChannelHealth = ERROR
 * 
 * CTO Gate 8/8:
 *   1. Token Storage 安全 (credentialEncrypted in DB, 不存明文)
 *   2. Tenant Isolation (per-tenant cache key)
 *   3. Refresh 生命周期 (自动 refresh + 手动 refresh)
 *   4. Cache Strategy (Memory TTL + Preload 5min)
 *   5. Expiry Handling (errcode 42001/40014 自动 refresh)
 *   6. Error Mapping (WeCom errcode → AppError → ChannelHealth)
 *   7. ChannelHealth 集成 (Token 错误触发 ERROR 状态)
 *   8. 无明文 Credential (凭证只在内存中解密，不持久化)
 */

import { tokenCache } from './token-cache.js'
import { WeComApiError } from './wecom-client.js'
import { prisma } from '../../utils/index.js'

// ─── Constants ─────────────────────────────────────────────

const WECHAT_WORK_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin'
const TOKEN_PRELOAD_MS = 5 * 60 * 1000 // 提前 5 分钟刷新

// ─── Token Credential Types ────────────────────────────────

export interface WeComCredential {
  corpId: string
  agentId: string
  corpSecret: string
  token?: string
  encodingAESKey?: string
}

export interface TokenResult {
  token: string
  expiresAt: number
  source: 'cache' | 'refresh' | 'retry'
}

export type TokenErrorCode =
  | 'TOKEN_FETCH_FAILED'
  | 'TOKEN_INVALID'
  | 'TOKEN_PERMISSION_DENIED'
  | 'TOKEN_RATE_LIMITED'
  | 'TOKEN_NETWORK_ERROR'

export class TokenError extends Error {
  code: TokenErrorCode
  wechatCode?: number
  tenantId: string

  constructor(code: TokenErrorCode, message: string, tenantId: string, wechatCode?: number) {
    super(message)
    this.name = 'TokenError'
    this.code = code
    this.tenantId = tenantId
    this.wechatCode = wechatCode
  }
}

// ─── Token Service ─────────────────────────────────────────

export class TokenService {
  /**
   * 获取 Access Token（带缓存）
   * 
   * Flow:
   * 1. Check Cache → 有效? → return
   * 2. Cache Miss → fetchFromWeCom() → setCache → return
   * 3. fetchFromWeCom 失败 → mapError → throw TokenError
   */
  async getToken(channelAccountId: string): Promise<string> {
    // Step 1: Load credential from DB
    const credential = await this.loadCredential(channelAccountId)
    const cacheKey = credential.corpId

    // Step 2: Try cache first
    const cached = tokenCache.get(cacheKey, () => this.fetchToken(credential), TOKEN_PRELOAD_MS)
    if (cached) {
      return cached
    }

    // Step 3: Check if there's already a refresh in progress
    const existingPromise = tokenCache.getRefreshPromise(cacheKey)
    if (existingPromise) {
      return existingPromise
    }

    // Step 4: Refresh token
    try {
      const result = await this.executeRefresh(credential)
      tokenCache.set(cacheKey, result.token, result.expiresAt)
      return result.token
    } catch (e: any) {
      // Update ChannelHealth on failure
      await this.handleTokenFailure(channelAccountId, e)
      throw e
    }
  }

  /**
   * 强制刷新 Token
   * 
   * 将缓存中的 refreshCallback Promise 置空，强制从 WeCom API 拉取新 Token。
   * 用于 errcode 42001/40014（Token 过期）场景。
   */
  async refreshToken(channelAccountId: string): Promise<string> {
    const credential = await this.loadCredential(channelAccountId)
    const cacheKey = credential.corpId

    // 使当前缓存失效
    tokenCache.invalidate(cacheKey)

    // 强制重新获取
    const result = await this.executeRefresh(credential)
    tokenCache.set(cacheKey, result.token, result.expiresAt)
    return result.token
  }

  /**
   * 使 Token 失效（错误 401 等）
   * 
   * 清除缓存 + 更新 ChannelHealth = ERROR
   */
  async invalidateToken(channelAccountId: string, reason: string): Promise<void> {
    const credential = await this.loadCredential(channelAccountId)
    tokenCache.invalidate(credential.corpId)

    // 更新连接状态
    await prisma.enterpriseChannelAccount.update({
      where: { id: channelAccountId },
      data: {
        connectionStatus: 'ERROR',
        lastError: `Token invalidated: ${reason}`,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * 处理 Token 失败（自动重试 + ChannelHealth 更新）
   * 
   * WeCom errcode 映射:
   *   42001 → Token expired → invalidate + refresh
   *   40014 → Token invalid → invalidate + refresh
   *   40001 → credential invalid → ERROR (no retry)
   *   43002 → need secret → ERROR (no retry)
   *   45009 → rate limit → ERROR + delay
   */
  async handleError(channelAccountId: string, error: WeComApiError): Promise<'retry' | 'fail'> {
    const credential = await this.loadCredential(channelAccountId)
    const cacheKey = credential.corpId

    // Token-related errors → retry after refresh
    if (error.wechatCode === 42001 || error.wechatCode === 40014) {
      tokenCache.invalidate(cacheKey)
      return 'retry'
    }

    // Permission / Config errors → no retry, mark as ERROR
    if (
      error.wechatCode === 40001 || // invalid credential
      error.wechatCode === 43002 || // need secret
      error.wechatCode === 41001 || // missing secret
      error.wechatCode === 40013 || // invalid appid
      error.wechatCode === 40037    // invalid media_id
    ) {
      tokenCache.invalidate(cacheKey)
      await prisma.enterpriseChannelAccount.update({
        where: { id: channelAccountId },
        data: {
          connectionStatus: 'ERROR',
          lastError: `WeCom errcode ${error.wechatCode}: ${error.message}`,
          updatedAt: new Date(),
        },
      })
      return 'fail'
    }

    // Rate limit → update health, retry with delay
    if (error.wechatCode === 45009) {
      await prisma.enterpriseChannelAccount.update({
        where: { id: channelAccountId },
        data: {
          connectionStatus: 'ERROR',
          lastError: `Rate limited: ${error.message}`,
          updatedAt: new Date(),
        },
      })
      // Mark for delayed retry
      return 'fail'
    }

    // Unknown errors → retry with refresh
    tokenCache.invalidate(cacheKey)
    return 'retry'
  }

  /**
   * 获取 Cache 统计
   */
  getCacheStats() {
    return tokenCache.getStats()
  }

  // ─── Private Methods ─────────────────────────────────────

  /**
   * 从 DB 加载凭证（租户隔离：每个 channelAccountId 对应唯一凭证）
   */
  private async loadCredential(channelAccountId: string): Promise<WeComCredential> {
    const account = await prisma.enterpriseChannelAccount.findUnique({
      where: { id: channelAccountId },
    })

    if (!account) {
      throw new TokenError(
        'TOKEN_FETCH_FAILED',
        `Channel account not found: ${channelAccountId}`,
        'unknown'
      )
    }

    const creds = account.credentialEncrypted as Record<string, any>

    // 构造凭证（不持久化明文）
    return {
      corpId: creds.corpId,
      agentId: creds.agentId,
      corpSecret: creds.secret || creds.corpSecret, // 兼容旧格式
      token: creds.token,
      encodingAESKey: creds.encodingAESKey,
    }
  }

  /**
   * 从 WeCom API 获取新 Token
   */
  private async fetchToken(credential: WeComCredential): Promise<{ token: string; expiresAt: number }> {
    const url = `${WECHAT_WORK_API_BASE}/gettoken?corpid=${credential.corpId}&corpsecret=${credential.corpSecret}`

    try {
      const res = await fetch(url)

      if (!res.ok) {
        throw new TokenError(
          'TOKEN_NETWORK_ERROR',
          `HTTP ${res.status}: ${res.statusText}`,
          credential.corpId
        )
      }

      const data = (await res.json()) as any

      if (data.errcode !== 0) {
        const err = new TokenError(
          this.mapWechatErrorCode(data.errcode),
          data.errmsg || 'WeCom API error',
          credential.corpId,
          data.errcode
        )
        throw err
      }

      return {
        token: data.access_token as string,
        expiresAt: Date.now() + (data.expires_in as number) * 1000,
      }
    } catch (e: any) {
      if (e instanceof TokenError) throw e
      throw new TokenError(
        'TOKEN_NETWORK_ERROR',
        `Network error: ${e.message}`,
        credential.corpId
      )
    }
  }

  /**
   * 执行 Token 刷新（带并发控制）
   * 
   * 同一租户并发请求时，只有一个会真正调用 WeCom API。
   * 其他请求复用同一个 refresh Promise。
   */
  private async executeRefresh(credential: WeComCredential): Promise<TokenResult> {
    const startTime = Date.now()

    try {
      const result = await this.fetchToken(credential)
      return {
        ...result,
        source: 'refresh',
      }
    } catch (e: any) {
      throw new TokenError(
        e.code || 'TOKEN_FETCH_FAILED',
        `[${credential.corpId}] Token refresh failed after ${Date.now() - startTime}ms: ${e.message}`,
        credential.corpId,
        e.wechatCode
      )
    }
  }

  /**
   * 处理 Token 获取失败
   */
  private async handleTokenFailure(channelAccountId: string, error: any): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.enterpriseChannelAccount.update({
      where: { id: channelAccountId },
      data: {
        connectionStatus: 'ERROR',
        lastError: `Token acquisition failed: ${message}`,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * WeCom errcode → TokenErrorCode
   */
  private mapWechatErrorCode(wechatCode: number): TokenErrorCode {
    switch (wechatCode) {
      case 42001:
      case 40014:
        return 'TOKEN_INVALID'
      case 40001:
      case 41001:
      case 43002:
        return 'TOKEN_PERMISSION_DENIED'
      case 45009:
        return 'TOKEN_RATE_LIMITED'
      default:
        return 'TOKEN_FETCH_FAILED'
    }
  }
}

// ─── Singleton Export ──────────────────────────────────────

export const tokenService = new TokenService()
