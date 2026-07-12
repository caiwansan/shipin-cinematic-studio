/**
 * runtime/platform/platform-provider-pool.ts — Platform AI Provider Pool
 *
 * Hybrid AI Runtime Architecture:
 *   Platform Runtime 管理平台自有 Provider 的凭证、配额、健康状态。
 *   Presence/Visibility Scan 等平台 AI 能力通过此 Pool 获取凭证。
 *
 * 设计原则：
 *   1. Pool 是唯一管理 Platform Provider 凭证的地方（SSOT）
 *   2. 所有 Provider 凭证加密存储
 *   3. 支持启用/禁用/配额/健康状态
 *   4. 不与 UserModelConfigV2 有任何交集
 */

import { prisma } from '../../utils/index.js'
import { decryptKey } from '../../services/crypto.service.js'

export interface PlatformCredential {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  /** Provider-specific extra config (xinghuo: { appid, apisecret }) */
  extraConfig?: Record<string, string>
}

export interface PlatformProviderStatus {
  provider: string
  isEnabled: boolean
  healthStatus: string
  dailyQuota: number
  dailyUsed: number
  lastHealthCheckAt: string | null
}

export class PlatformProviderPool {
  /**
   * 获取指定 Provider 的明文凭据
   * 仅限 Platform Runtime 使用（Presence/Visibility Scan）
   */
  async getCredential(provider: string): Promise<PlatformCredential | null> {
    const rows: any[] = await prisma.$queryRawUnsafe(
        'SELECT id, provider, encrypted_api_key AS "encryptedApiKey", "baseUrl", model, is_enabled AS "isEnabled", daily_quota AS "dailyQuota", daily_used AS "dailyUsed", health_status AS "healthStatus", last_health_check_at AS "lastHealthCheckAt", cost_per_call AS "costPerCall" FROM platform_provider_config WHERE provider = $1 LIMIT 1',
        provider
      )
    const config = rows[0] || null
    if (!config || !config.isEnabled) return null

    let apiKey: string
    let extraConfig: Record<string, string> | undefined

    try {
      const decrypted = decryptKey(config.encryptedApiKey)

      // xinghuo 的 encryptedApiKey 存的是 JSON: {"apiKey":"...","appid":"...","apisecret":"..."}
      if (provider === 'xinghuo') {
        try {
          const parsed = JSON.parse(decrypted) as Record<string, string>
          apiKey = parsed.apiKey || ''
          extraConfig = { appid: parsed.appid || '', apisecret: parsed.apisecret || '' }
        } catch {
          // 如果解析失败，当做纯字符串处理（兼容旧数据）
          apiKey = decrypted
          extraConfig = { appid: '', apisecret: '' }
        }
      } else {
        apiKey = decrypted
      }
    } catch {
      return null
    }

    return {
      provider: config.provider,
      apiKey,
      baseUrl: config.baseUrl || '',
      model: config.model,
      extraConfig,
    }
  }

  /**
   * 获取所有已启用的 Provider 列表
   */
  async getEnabledProviders(): Promise<string[]> {
    const configs: any[] = await prisma.$queryRawUnsafe(
        'SELECT provider, is_enabled as "isEnabled" FROM platform_provider_config WHERE is_enabled = true'
      )
    return configs.map(c => c.provider)
  }

  /**
   * 获取所有 Provider 状态（含未启用的）
   */
  async getAllStatuses(): Promise<PlatformProviderStatus[]> {
    const configs: any[] = await prisma.$queryRawUnsafe(
        'SELECT provider, is_enabled as "isEnabled", health_status as "healthStatus", daily_quota as "dailyQuota", daily_used as "dailyUsed", last_health_check_at as "lastHealthCheckAt" FROM platform_provider_config'
      )
    return configs.map(c => ({
      provider: c.provider,
      isEnabled: c.isEnabled,
      healthStatus: c.healthStatus,
      dailyQuota: c.dailyQuota,
      dailyUsed: c.dailyUsed,
      lastHealthCheckAt: c.lastHealthCheckAt?.toISOString() || null,
    }))
  }

  /**
   * 检查 Provider 当日配额是否已用尽
   */
  async checkQuota(provider: string): Promise<boolean> {
    const rows: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM platform_provider_config WHERE provider = $1 LIMIT 1',
        provider
      )
    const config = rows[0] || null
    if (!config || !config.is_enabled) return false
    if (config.daily_quota === 0) return true // 0 = unlimited
    return config.daily_used < config.daily_quota
  }

  /**
   * 增加 Provider 当日使用次数
   */
  async incrementUsage(provider: string): Promise<void> {
    await prisma.$executeRawUnsafe(
        'UPDATE platform_provider_config SET daily_used = daily_used + 1 WHERE provider = $1',
        provider
      )
  }

  /**
   * 记录平台调用日志
   */
  async logUsage(params: {
    provider: string
    capability: string
    modelName: string
    tokensIn: number
    tokensOut: number
    latencyMs: number
    cost: number
    success: boolean
    errorMessage?: string
    triggeredBy?: string
  }): Promise<void> {
    await prisma.$executeRawUnsafe(
        `INSERT INTO platform_usage_log (id, provider, capability, model_name, tokens_in, tokens_out, latency_ms, cost, success, error_message, triggered_by) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        params.provider,
        params.capability,
        params.modelName,
        params.tokensIn,
        params.tokensOut,
        params.latencyMs,
        params.cost,
        params.success,
        params.errorMessage || null,
        params.triggeredBy || null
      )
  }

  /**
   * 更新 Provider 健康状态
   */
  async updateHealthStatus(provider: string, status: string, cost: number): Promise<void> {
    await prisma.$executeRawUnsafe(
        "UPDATE platform_provider_config SET health_status = $1, cost_per_call = $2, last_health_check_at = NOW() WHERE provider = $3",
        status, cost, provider
      )
  }
}

export const platformProviderPool = new PlatformProviderPool()
