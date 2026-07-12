/**
 * runtime/platform/platform-runtime.service.ts — Platform AI Runtime
 *
 * Hybrid AI Runtime Architecture:
 *   PlatformRuntimeService 管理所有平台 AI 调用（Presence/Visibility Scan）。
 *   与 User Runtime 共享 UnifiedAIGateway，但使用平台自有 Provider Pool。
 *
 * v2 重构 (Provider Compatibility Layer):
 *   - providers 数组改为从 ProviderRegistry 动态加载
 *   - 不再硬编码 baseUrl/model
 *   - 配置信息 SSOT 在 Provider Profile 中
 *
 * 职责：
 *   1. 从 PlatformProviderPool 获取凭证
 *   2. 通过 UnifiedAIGateway.callLLM() 执行调用
 *   3. 配额检查与用量统计
 *   4. 健康检查
 *   5. 成本统计
 *
 * 不做什么：
 *   ❌ 不读取 UserModelConfigV2
 *   ❌ 不读取 process.env（bootstrapping 除外）
 *   ❌ 不持久化用户数据
 */

import { platformProviderPool, type PlatformCredential } from './platform-provider-pool.js'
import { ProviderRegistry, getAll } from '../../platform/providers/provider-registry.js'

export class PlatformRuntimeService {
  /**
   * 使用指定 Platform Provider 调用 LLM
   * 供 Presence/Visibility Scan 使用
   */
  async callLLM(params: {
    provider: string
    messages: Array<{ role: string; content: string }>
    maxTokens?: number
    temperature?: number
  }): Promise<{ content: string; tokensIn: number; tokensOut: number; latencyMs: number; cost: number }> {
    const { provider, messages, maxTokens, temperature } = params

    // 1. 配额检查
    const quotaOk = await platformProviderPool.checkQuota(provider)
    if (!quotaOk) {
      throw new Error(`Provider ${provider} 当日配额已用尽`)
    }

    // 2. 获取凭证
    const credential = await platformProviderPool.getCredential(provider)
    if (!credential) {
      throw new Error(`Provider ${provider} 未配置或已禁用`)
    }

    // 3. 通过 UnifiedAIGateway 调用
    const { unifiedAIGateway } = await import('../../services/unified-ai-gateway.js')
    const start = Date.now()

    try {
      // 从 ProviderRegistry 获取 Profile 中的模型信息
      const profile = ProviderRegistry.get(provider)
      const model = credential.model || profile?.models?.[0] || 'default'

      const result = await unifiedAIGateway.callLLM({
        provider,
        model,
        messages,
        apiKey: credential.apiKey,
        baseUrl: credential.baseUrl || undefined,
        maxTokens: maxTokens || 1024,
        temperature: temperature ?? 0.3,
        extraConfig: credential.extraConfig,
      })
      const latencyMs = Date.now() - start

      // 4. 统计用量
      const tokensIn = result.tokens?.input || 0
      const tokensOut = result.tokens?.output || 0
      const cost = this.estimateCost(provider, tokensIn, tokensOut)

      await platformProviderPool.incrementUsage(provider)
      await platformProviderPool.logUsage({
        provider,
        capability: 'llm',
        modelName: model,
        tokensIn,
        tokensOut,
        latencyMs,
        cost,
        success: true,
        triggeredBy: '__platform__',
      })

      return {
        content: result.content,
        tokensIn,
        tokensOut,
        latencyMs,
        cost,
      }
    } catch (err: any) {
      const latencyMs = Date.now() - start

      await platformProviderPool.logUsage({
        provider,
        capability: 'llm',
        modelName: credential.model || '',
        tokensIn: 0,
        tokensOut: 0,
        latencyMs,
        cost: 0,
        success: false,
        errorMessage: err.message.substring(0, 500),
        triggeredBy: '__platform__',
      })

      throw err
    }
  }

  /**
   * 运行全部已启用 Provider 的健康检查
   */
  async runHealthChecks(): Promise<void> {
    const providers = await platformProviderPool.getEnabledProviders()
    for (const provider of providers) {
      try {
        await this.callLLM({
          provider,
          messages: [{ role: 'user', content: 'Reply with one word: ok' }],
          maxTokens: 10,
          temperature: 0.1,
        })
        await platformProviderPool.updateHealthStatus(provider, 'healthy', 0.001)
      } catch {
        await platformProviderPool.updateHealthStatus(provider, 'down', 0)
      }
    }
  }

  /**
   * 加载初始 Platform Provider
   * 启动时调用，从 process.env 导入并加密存储
   * v2: 从 ProviderRegistry 动态获取 providers 列表，移除硬编码
   */
  async bootstrapFromEnv(): Promise<void> {
    // 从 ProviderRegistry 获取所有注册的 Provider
    const profiles = getAll()
    const providers = profiles.map(p => ({
      envKey: `${p.name.toUpperCase()}_API_KEY`,
      provider: p.name,
      baseUrl: p.baseUrl,
      model: p.models[0],
    }))

    const { encryptKey } = await import('../../services/crypto.service.js')
    const { prisma } = await import('../../utils/index.js')

    for (const p of providers) {
      const rawKey = process.env[p.envKey]
      if (!rawKey) continue

      // 处理讯飞星火的特殊多字段凭证
      let keyToEncrypt = rawKey
      if (p.provider === 'xinghuo') {
        // xinghuo 的 env var 期望是 JSON: {"apiKey":"...","appid":"...","apisecret":"..."}
        try {
          const parsed = JSON.parse(rawKey)
          if (parsed.apiKey && parsed.appid && parsed.apisecret) {
            keyToEncrypt = rawKey // 已经是 JSON 格式
          }
        } catch {
          // 不是 JSON 格式，跳过（将在 admin API 中手动配置）
          continue
        }
      }

      const encrypted = encryptKey(keyToEncrypt)
      await prisma.platformProviderConfig.upsert({
        where: { provider: p.provider },
        update: {
          encryptedApiKey: encrypted,
          baseUrl: p.baseUrl,
          model: p.model,
          isEnabled: true,
        },
        create: {
          provider: p.provider,
          encryptedApiKey: encrypted,
          baseUrl: p.baseUrl,
          model: p.model,
          isEnabled: true,
        },
      })
    }
  }

  private estimateCost(provider: string, tokensIn: number, tokensOut: number): number {
    // 粗略价格估算（每 1K token 的美元成本）
    const rates: Record<string, { in: number; out: number }> = {
      openai: { in: 0.00015, out: 0.0006 },
      claude: { in: 0.0008, out: 0.004 },
      gemini: { in: 0.0001, out: 0.0004 },
      deepseek: { in: 0.00027, out: 0.0011 },
      doubao: { in: 0.0002, out: 0.0006 },
      kimi: { in: 0.001, out: 0.002 },
    }
    const rate = rates[provider] || { in: 0.001, out: 0.002 }
    return (tokensIn / 1000) * rate.in + (tokensOut / 1000) * rate.out
  }
}

export const platformRuntimeService = new PlatformRuntimeService()
